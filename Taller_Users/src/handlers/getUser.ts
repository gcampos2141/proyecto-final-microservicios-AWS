import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import {  GetCommand } from "@aws-sdk/lib-dynamodb"
import { dynamo } from "../lib/dynamodb"
import { badRequest, internalError, notFound, ok, unauthorized } from "../lib/response"
import { withCors } from "../common/cors"

const USERS_TABLE = process.env.USERS_TABLE

/**
 * @ENDPOINT GET /users/{id}
 * @DESCRIPTION Permite obtener la información de un usuario existente. El id del usuario a obtener se recibe como path parameter. Si el usuario no existe, 
 * retorna un error 404. Si el usuario existe, retorna la información del usuario (excepto la contraseña).
 */
export async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {
        const userId = event.pathParameters?.id;
        if (!userId) {
            return notFound('El id es necesario en el path.');
        }
        
        const result = await dynamo.send(
            new GetCommand({
                TableName: USERS_TABLE,
                Key: { userId }
            })
        )

        if (!result.Item) {
            return notFound("Usuario no encontrado en la base de datos.")
        }

        const { password:_, ...userPublic } = result.Item

        return ok({user: userPublic})
        
    } catch (error) {
        console.error("Error al obtener el usuario", error)
        return internalError("Error al obtener el usuario.")

    }        

}

export const getUser = withCors(handler);