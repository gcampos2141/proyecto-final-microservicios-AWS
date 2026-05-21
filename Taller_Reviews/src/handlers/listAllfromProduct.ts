import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import { QueryCommand } from "@aws-sdk/lib-dynamodb"
import { dynamo } from "../lib/dynamodb"
import { badRequest, internalError, ok } from "../lib/response"
import { withCors } from "../common/cors"

const REVIEWS_TABLE = process.env.REVIEWS_TABLE

/**
 * @ENDPOINT GET /products/{id}/reviews
 * @DESCRIPTION Obtiene todas las reseñas para un producto específico. El ID del producto se recibe como path parameter. Retorna un arreglo con todas las reseñas asociadas a ese producto. 
 * Si el producto no tiene reseñas, retorna un arreglo vacío. 
 */
async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {
        const productId = event.pathParameters?.id;
        if (!productId) {
            return badRequest("El productId es requerido para listar las reseñas de un producto.")
        }
        
        const result = await dynamo.send(
            new QueryCommand({
                TableName: REVIEWS_TABLE,
                IndexName: "ProductReviewIndex",
                KeyConditionExpression: "productId = :productId",
                ExpressionAttributeValues: {
                    ":productId": productId
                }
            })
        )
        const reviews = result.Items ?? [];

        return ok({Reviews: reviews})
        
    } catch (error) {
        console.error("Error al obtener todas las reseñas", error)
        return internalError("Error al obtener todas las reseñas.")

    }        

}

export const listAllfromProduct = withCors(handler);