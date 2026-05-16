import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import { GetCommand,  UpdateCommand } from "@aws-sdk/lib-dynamodb"
import { dynamo } from "../lib/dynamodb"
import { badRequest, internalError, notFound, ok, unauthorized } from "../lib/response"
import { withCors } from "../common/cors"

const USERS_TABLE = process.env.USERS_TABLE

export async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {
        const userId = event.pathParameters?.id;
        if (!userId) {
            return notFound('El id es necesario en el path');
        }

        const callerId = event.requestContext.authorizer?.userId;

        if (callerId != userId) {
            return badRequest("Solo puedes actualizar tu propio usuario")
        }
         
        const body = JSON.parse(event.body ?? "{}")
        const { name } = body;

        if (!name) {
            return badRequest("El nombre es requerido")
        }
        const existing = await dynamo.send(
            new GetCommand({
                TableName: USERS_TABLE,
                Key: { userId }
            })
        )

        if (!existing.Item) {
            return notFound("Usuario no encontrado en la base de datos")
        }

        const now = new Date().toISOString();
        await dynamo.send(
            new UpdateCommand({
                TableName: USERS_TABLE,
                Key: { userId },
                UpdateExpression: "SET #name = :name, updatedAt = :updatedAt",
                ExpressionAttributeNames: {"#name": "name"},
                ExpressionAttributeValues: { ":name": name, ":updatedAt": now }
            })
        )

        return ok({ messsage: "Usuario Actualizado Existosamente" })
        
    } catch (error) {
        console.error("Error al obtener el usuario", error)
        return internalError("Error al obtener el usuario")

    }        

}

export const updateUser = withCors(handler);