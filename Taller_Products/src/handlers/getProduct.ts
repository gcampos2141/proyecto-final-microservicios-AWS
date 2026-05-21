import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import {  GetCommand } from "@aws-sdk/lib-dynamodb"
import { dynamo } from "../lib/dynamodb"
import { internalError, notFound, ok } from "../lib/response"
import { withCors } from "../common/cors"

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE

/**
 * @ENDPOINT GET /products/{id}
 * @DESCRIPTION Permite obtener los detalles de un producto específico. El producto se identifica por su ID, que se recibe como parámetro en la ruta. 
 * Si el producto existe, se retorna un objeto con sus detalles (productId, name, price, stock, sellerId). Si el producto no existe, se retorna un error 404.
 */
export async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {
        const productId = event.pathParameters?.id;
        if (!productId) {
            return notFound('El producto no fue encontrado.');
        }
        
        const result = await dynamo.send(
            new GetCommand({
                TableName: PRODUCTS_TABLE,
                Key: { productId }
            })
        )

        if (!result.Item) {
            return notFound("Producto no encontrado en la base de datos.")
        }

        return ok({Product: result.Item})
        
    } catch (error) {
        console.error("Error al obtener el usuario", error)
        return internalError("Error al obtener el usuario.")

    }        

}

export const getProduct = withCors(handler);