import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import {  ScanCommand } from "@aws-sdk/lib-dynamodb"
import { dynamo } from "../lib/dynamodb"
import { internalError, notFound, ok } from "../lib/response"
import { withCors } from "../common/cors"

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE

/**
 * @ENDPOINT GET /products
 * @DESCRIPTION Permite obtener una lista de todos los productos disponibles. Retorna un arreglo de objetos, donde cada objeto representa 
 * un producto con sus detalles (productId, name, price, stock, sellerId). Si no hay productos disponibles, se retorna un arreglo vacío.
 */
async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {
        const result = await dynamo.send(
            new ScanCommand({
                TableName: PRODUCTS_TABLE,
            })
        )

        if (!result.Items) {
            return notFound("Producto no encontrado en la base de datos.")
        }

        return ok({Products: result.Items})
        
    } catch (error) {
        console.error("Error al obtener todos los productos", error)
        return internalError("Error al obtener todos los productos.")

    }        

}

export const listAllProducts = withCors(handler);