import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import { DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb"
import { dynamo } from "../lib/dynamodb"
import { badRequest, internalError, notFound, ok, unauthorized } from "../lib/response"
import { withCors } from "../common/cors"

const USERS_TABLE = process.env.USERS_TABLE

/**
 * @ENDPOINT DELETE /users/{id}
 * @DESCRIPTION Permite eliminar un usuario existente. El id del usuario a eliminar se recibe como path parameter. Solo el usuario dueño de la cuenta puede eliminarla. 
 * Si el usuario no existe, retorna un error 404. Si el usuario existe pero el caller no es el dueño de la cuenta, retorna un error 400. Si la eliminación es exitosa, retorna un mensaje de éxito.
 */
export async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {
        const userId = event.pathParameters?.id;
        if (!userId) {
            return notFound('El id es necesario en el path.');
        }

        const callerId = event.requestContext.authorizer?.userId;

        if (callerId != userId) {
            return badRequest("Solo puedes eliminar a tu propio usuario.")
        }
         
        const existing = await dynamo.send(
            new GetCommand({
                TableName: USERS_TABLE,
                Key: { userId }
            })
        )

        if (!existing.Item) {
            return notFound("Usuario no encontrado en la base de datos.")
        }

        await dynamo.send(
            new DeleteCommand({
                TableName: USERS_TABLE,
                Key: { userId },
            })
        )

        return ok({ messsage: "Usuario Eliminado Existosamente." })
        
    } catch (error) {
        console.error("Error al obtener el usuario", error)
        return internalError("Error al obtener el usuario.")

    }        

}

export const deleteUser=withCors(handler);