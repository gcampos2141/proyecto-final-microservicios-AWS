import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import {  QueryCommand } from "@aws-sdk/lib-dynamodb"
import { dynamo } from "../lib/dynamodb"
import { internalError, notFound, ok } from "../lib/response"
import { withCors } from "../common/cors"

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE

/**
 * @ENDPOINT GET /products/seller/{sellerId}
 * @DESCRIPTION Permite obtener una lista de productos asociados a un vendedor específico. El vendedor se identifica por su ID, que se recibe como parámetro en la ruta. 
 * Retorna un arreglo de objetos, donde cada objeto representa un producto con sus detalles (productId, name, price, stock, sellerId). Si el vendedor no tiene productos 
 * disponibles, se retorna un arreglo vacío.
 */
export async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {
        const sellerId = event.pathParameters?.sellerId;
        if (!sellerId) {
            return ok({ products: [] });
        }

        const result = await dynamo.send(
            new QueryCommand({
                TableName: PRODUCTS_TABLE,
                IndexName: "sellerIndex",
                KeyConditionExpression: "sellerId = :sellerId",
                ExpressionAttributeValues: {":sellerId" : sellerId}
            })
        )

        if (!result.Items) {
            return notFound("Productos no encontrados en la base de datos.")
        }

        return ok({ products: result.Items ?? [] })
        
    } catch (error) {
        console.error(`Error al obtener productos para sellerId ${event.pathParameters?.sellerId}:`, error)
        return internalError("Error al obtener todos los productos.")

    }        

}

export const listProductsBySeller = withCors(handler);