import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import {  QueryCommand } from "@aws-sdk/lib-dynamodb"
import { dynamo } from "../lib/dynamodb"
import { forbidden, internalError, notFound, ok } from "../lib/response"
import { withCors } from "../common/cors"

const ORDERS_TABLE = process.env.ORDERS_TABLE

/**
 * @ENDPOINT GET /products/{id}/check-purchased
 * @DESCRIPTION Permite verificar si un usuario ha comprado un producto específico. Recibe el ID del producto por path parameter y 
 * el ID del usuario se obtiene del authorizer. Consulta la base de datos de órdenes para verificar si el usuario ha comprado el 
 * producto y si la orden está confirmada. Retorna un objeto con una propiedad "purchased" que indica si el usuario ha comprado 
 * el producto o no.
 */

export async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {
        const userId = event.requestContext.authorizer?.userId;
        // Teoricamente el user id deberia estar siempre presente porque el endpoint está protegido por authorizer, pero se valida por seguridad
        if (!userId || userId === "undefined") {
            return notFound('El usuario no fue encontrado.')
        }
        
        const productId = event.pathParameters?.id;
        // El productId se recibe por path parameter, pero se valida por seguridad y para evitar errores en la consulta a la base de datos
        if (!productId) {
            return notFound('El producto no existe.')
        }

        // Consulta a la DB para verificar la compra por el usuario que intentaria crear una reseña, 
        // para evitar reseñas falsas de usuarios que no han comprado el producto
        const res = await dynamo.send(
            new QueryCommand({
                TableName: ORDERS_TABLE,
                IndexName: "UserOrderIndex",
                KeyConditionExpression: "userId = :userId",
                ExpressionAttributeValues: {
                    ":userId": userId
                }
            })       
        )

        const orders = res.Items ?? [];
        if (orders.length === 0) {
            return notFound('El usuario no ha comprado este producto.')
        }
    
        const ordersWithProduct = orders.filter(order => 
            order.items?.some((p: any) => p.productId === productId)
        );

        // El producto no aparece en el historial de órdenes del usuario
        if (ordersWithProduct.length === 0) {
            return forbidden("El usuario no ha comprado este producto.");
        }

        // Se evalua el estado de las órdenes que sí contienen el producto
        // Se verifica si al menos una de esas órdenes cumple con los requisitos para reseñar
        const tieneOrdenValida = ordersWithProduct.some(order => 
            order.status === "confirmed" && order.userId === userId
        );

        // -------- Los mensajes de error son irrelevantesm, ya que el usuario no los verá debido a que el endpoint solo es llamado por el modulo de reseñas, 
        // -------- pero se puso por buenas prácticas y para tener claridad en el código o por si en algún momento se decide exponer el 
        // -------- endpoint directamente a los clientes o a administradores para verificar compras, etc
        if (!tieneOrdenValida) {
            const principalOrden = ordersWithProduct[0];
            if (principalOrden.status !== "confirmed") {
                return forbidden(`No puedes reseñar este producto porque tu orden se encuentra en estado: ${principalOrden.status}`);
            }
        }

        // Si pasa todas las validaciones, se retorna true para el modulo de reseñas
        return ok({ purchased: true });
    } catch (error) {
        console.error(`Error al intentar comprobar la compra del producto para userId ${event.pathParameters?.userId}:`, error)
        return internalError("Error al comprobar la compra del producto.")

    }        

}

export const checkProductPurchased = withCors(handler);