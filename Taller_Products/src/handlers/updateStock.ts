import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import { GetCommand,  UpdateCommand } from "@aws-sdk/lib-dynamodb"
import { dynamo } from "../lib/dynamodb"
import { badRequest, forbidden, internalError, notFound, ok, unauthorized } from "../lib/response"
import { withCors } from "../common/cors"

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE

/**
 * @ENDPOINT PUT /products/{id}/stock
 * @DESCRIPTION Permite actualizar el stock de un producto existente. El producto a actualizar se identifica por su ID, que se recibe como parámetro en la ruta. 
 * En el cuerpo de la solicitud se debe incluir el campo quantity, que indica la cantidad a decrementar del stock actual. Se valida que quantity sea un número entero positivo y que el producto tenga suficiente stock para cubrir la cantidad solicitada. 
 * Si el producto no existe o no tiene suficiente stock, se retorna un error adecuado. Si la actualización es exitosa, se retorna un mensaje de confirmación.
 */
export async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {
        const productId = event.pathParameters?.id;
        if (!productId) {
            return notFound('El producto no fue encontrado.');
        }
         
        const existing = await dynamo.send(
            new GetCommand({
                TableName: PRODUCTS_TABLE,
                Key: { productId }
            })
        )
        
        if (!existing.Item) {
            return notFound("El producto no fue encontrado en la base de datos.")
        }

        const body =  JSON.parse(event.body ?? "{}")
        const { quantity } = body;

        if (quantity === undefined || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0 ) {
            return badRequest("El stock tiene que ser un valor positivo entero.");
        }

        if (existing.Item.stock < quantity) {
            return badRequest("Stock Insuficiente.")
        }


        const now = new Date().toISOString()
        await dynamo.send(
            new UpdateCommand({
                TableName: PRODUCTS_TABLE,
                Key: { productId },
                UpdateExpression: `SET stock = stock - :quantity, updatedAt = :updatedAt`,
                ConditionExpression: "stock >= :quantity",
                ExpressionAttributeValues: {":quantity":quantity, ":updatedAt":now}

            })
        );

        return ok({ messsage: "Stock Actualizado Existosamente." })
        
    } catch (error) {
        console.error("Error al obtener el usuario", error)
        return internalError("Error al obtener el usuario.")

    }        

}

export const updateStock = withCors(handler);