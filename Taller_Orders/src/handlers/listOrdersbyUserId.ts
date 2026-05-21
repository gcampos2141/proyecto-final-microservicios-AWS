import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import {  QueryCommand } from "@aws-sdk/lib-dynamodb"
import { dynamo } from "../lib/dynamodb"
import { forbidden, internalError, notFound, ok } from "../lib/response"
import { withCors } from "../common/cors"

const ORDERS_TABLE = process.env.ORDERS_TABLE

/**
 * @ENDPOINT GET /orders/user/{userId}
 * @DESCRIPTION Obtiene todas las órdenes de un usuario específico, validando que el usuario autenticado (callerId) 
 * sea el mismo que el userId en la ruta para garantizar que solo puedan acceder a sus propias órdenes.
 */
export async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {
        const userId = event.pathParameters?.userId;
        const callerId = event.requestContext.authorizer?.userId as string;

        console.log(`Obteniendo ordenes para userId ${userId} por callerId ${callerId}`)

        if (!userId) {
            return notFound('El usuario no fue encontrado.');
        }
        if (userId !== callerId) {
            return forbidden("Solo puedes verificar las ordenes de tu autoría.")
        }

        const result = await dynamo.send(
            new QueryCommand({
                TableName: ORDERS_TABLE,
                IndexName: "UserOrderIndex",
                KeyConditionExpression: "userId = :userId",
                ExpressionAttributeValues: {":userId" : userId},
                // Conseguir más recientes primero DESC
                ScanIndexForward: false
            })
        )

        if (!result.Items) {
            return notFound("Ordenes no encontradas en la base de datos.")
        }

        return ok({ orders: result.Items ?? [] })
        
    } catch (error) {
        console.error(`Error al obtener ordenes para userId ${event.pathParameters?.userId}:`, error)
        return internalError("Error al obtener todas las ordenes.")

    }        

}

export const listOrdersbyUserId = withCors(handler);