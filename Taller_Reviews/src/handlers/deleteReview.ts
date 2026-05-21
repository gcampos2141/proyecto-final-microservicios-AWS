import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import { DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb"
import { dynamo } from "../lib/dynamodb"
import { forbidden, internalError, notFound, ok } from "../lib/response"
import { withCors } from "../common/cors"

const REVIEWS_TABLE = process.env.REVIEWS_TABLE

/**
 * @ENDPOINT POST /reviews/{id}
 * @DESCRIPTION Permite eliminar una reseña existente. El ID de la reseña se recibe como path parameter. El userId se obtiene del authorizer. Se valida que la reseña exista 
 * y que el usuario que intenta eliminarla sea el mismo que la creó para evitar que un usuario pueda eliminar reseñas de otros usuarios. Si todo es válido, se elimina la reseña de la base de datos.
 */
export async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {
        const reviewId = event.pathParameters?.id;
        console.log(`Intentando eliminar review con reviewId: ${reviewId}`)
        if(!reviewId) {
            return notFound('La review no existe.');
        }

        // Validamos que la review exista antes de intentar eliminarla para retornar un error 404 en caso de que no exista
        // Aunque al tenner authorizer en el API Gateway, el usuario no autorizado no podría llegar a este punto
        const callerId = event.requestContext.authorizer?.userId;
        console.log(`Usuario que hace la solicitud de eliminación: ${callerId}`)
        if (!callerId) {
            return forbidden("No se pudo identificar al usuario que hace la solicitud.")
        }

        const existing = await dynamo.send(
            new GetCommand({
                TableName: REVIEWS_TABLE,
                Key: { reviewId }
            })
        )
        if (!existing.Item) {
            console.log(`Review con reviewId: ${reviewId} no existe.`);
            return notFound('La review no existe.');
        }

        // Validar que el usuario que intenta eliminar la review es el mismo que la creó para evitar 
        // que un usuario pueda eliminar reseñas de otros usuarios
        if (existing.Item.userId !== callerId) {
            return forbidden("No tienes permisos para eliminar esta review.")
        }

        // Si la review existe y el usuario tiene permisos para eliminarla, procedemos a eliminarla de la base de datos
        await dynamo.send(
            new DeleteCommand({
                TableName: REVIEWS_TABLE,
                Key: { reviewId },
            })
        )
        return ok({ message: "Review Eliminada Existosamente." })
        
    } catch (error) {
        console.error("Error al tratar de eliminar la review", error)
        return internalError("Error al tratar de eliminar la review.")

    }        

}

export const deleteReview = withCors(handler);