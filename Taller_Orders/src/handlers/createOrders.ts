import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import {PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb"
import { v4 as uuidv4 } from "uuid"
import { dynamo } from "../lib/dynamodb"
import { badRequest, created, internalError } from "../lib/response"
import { Order, OrderItem } from "../types/order"
import { invokeLambda, productFn } from "../lib/lambdaInvoke"
import { withCors } from "../common/cors"

const ORDERS_TABLE = process.env.ORDERS_TABLE;

// --------------------------------------------------------------
// FUNCIONES AUXILIARES PARA INTERACCIÓN CON EL MICROSERVICIO DE PRODUCTOS
// --------------------------------------------------------------
async function fetchProduct(productId: string): Promise <{productId: string; price: number; stock: number; name: string, sellerId: string } | null> {
    try {
        const res = await invokeLambda<{ Product: { productId: string; price: number; stock: number; name: string; sellerId: string; } }>(
            productFn("Get"),
            { pathParameters: { id: productId } }
        )

        console.log("Respuesta del lambda:", JSON.stringify(res));  

        if (res.statusCode !== 200 || !res.body.Product) return null;
        return res.body.Product;

    } catch (error) {
        console.error("Error fetching product", error)
        return null
    }
}

async function decrementStock(productId: string, quantity: number): Promise <boolean>{
    try {
        const res = await invokeLambda(
            productFn("UpdateStock"), 
            { 
                pathParameters: { id: productId }, 
                body: JSON.stringify({ quantity }) 
            }
        )
        return res.statusCode === 200;
    } catch (error) {
        return false
    }
}

/**
 * @ENDPOINT POST /orders
 * @DESCRIPTION Permite crear una nueva orden. Recibe un arreglo de items con productId, quantity y price. El userId se obtiene del authorizer. 
 * Valida que los productos existan, que el usuario no sea el vendedor de los productos y que haya stock suficiente. Si todo es válido, 
 * crea la orden con estado "pending", guarda la orden en la base de datos y decrementa el stock de cada producto. Si falla el decremento 
 * de stock para algún producto, cancela la orden y retorna un error.
 */
export async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {
        const userId = event.requestContext.authorizer?.userId;
        const body =JSON.parse(event.body ?? "{}");
        const { items } = body as { items: Array<{productId: string, quantity: number, price: number}> };

        if (!items || !Array.isArray(items) || items.length === 0) {
            return badRequest("Se requieren de items para crear una orden.")
        }

        for (const item of items) {
            if (!item.productId || typeof item.quantity !== "number" || item.quantity < 1 || !Number.isInteger(item.quantity)) {
                return badRequest("Los items no cumplen con las validaciones necesarias para ser procesados.")
            }
        }

        const resolvedItems : OrderItem[] = [];

        // --------------------------------------------------------------
        // Se validan los productos uno por uno para dar mensajes de error 
        // específicos por producto, y para evitar hacer llamadas innecesarias 
        // al microservicio de productos en caso de que el primer producto 
        // ya tenga un error (ejemplo: producto no existe)
        // --------------------------------------------------------------
        for (const item of items) {
            const product = await fetchProduct(item.productId);
            if (!product) {
                return badRequest(`El producto ${item.productId} no existe`)
            }

            // Validación para evitar que el buyerID seas el mismo que el sellerID del producto,
            // para evitar que los vendedores puedan crear órdenes falsas de sus propios productos 
            // y así generar reseñas falsas o sesgadas
            if (product.sellerId === userId) {
                return badRequest("No puedes comprar tu propio producto, por favor revisa tu orden.")
            }

            if (product.stock < item.quantity) {
                return badRequest(`Stock insuficiente para ${product.name}.`);
            }

            resolvedItems.push({
                productId: item.productId,
                quantity: item.quantity,
                price: product.price,
            })
        }

        const total = resolvedItems.reduce((sum, i) => sum + i.price * i.quantity, 0)

        const now = new Date().toISOString()

        const order: Order = {
            orderId: uuidv4(),
            userId,
            items: resolvedItems,
            total,
            status: "pending",
            createdAt: now,
            updatedAt: now
        }

        await dynamo.send(
            new PutCommand({
                TableName: ORDERS_TABLE,
                Item: order
            })
        )

        const decremented: OrderItem[] = [];

        // --------------------------------------------------------------
        // Se decrementa el stock de cada producto uno por uno para poder 
        // revertir en caso de que falle el decremento de alguno, 
        // y así evitar inconsistencias en el stock. Si se hiciera 
        // un decremento masivo y fallara, sería más complicado manejar 
        // la reversión del stock ya decrementado.
        // --------------------------------------------------------------
        for(const item of resolvedItems){
            const success = await decrementStock( item.productId, item.quantity );
            if (!success) {
                console.error(`Fallo al decrementarse el stock del producto ${ item.productId }`)
                await dynamo.send(
                    new UpdateCommand({
                        TableName: ORDERS_TABLE,
                        Key: { orderId: order.orderId },
                        UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
                        ExpressionAttributeNames: { "#status": "status" },
                        ExpressionAttributeValues: {
                            ":status" : "canceled",
                            ":updatedAt": new Date().toISOString()
                        }
                    })
                )
                return internalError("No se pudo reservar el stock para uno o más productos. La orden ha sido cancelada.")
            }
            decremented.push(item);
        }

        return created({order})

    } catch (error) {
      console.error("Error al crear la orden", error)
      return{
        statusCode: 500,
        body: JSON.stringify({message: "Hubo un error al crear la orden."})
      }
    }
}

export const createOrders = withCors(handler);