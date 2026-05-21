import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import { GetCommand } from "@aws-sdk/lib-dynamodb"
import { dynamo } from "../lib/dynamodb"
import { forbidden, internalError, notFound, ok } from "../lib/response"
import { withCors } from "../common/cors"

const ORDERS_TABLE = process.env.ORDERS_TABLE

/**
 * @ENDPOINT GET /orders/{id}
 * @DESCRIPTION Obtiene los detalles de una orden específica por su ID, asegurándose de que el usuario autenticado sea el propietario de la orden.
 */
export async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {
        const orderId = event.pathParameters?.id;
        if (!orderId) {
            return notFound('El pedido no fue encontrado.');
        }

        const callerId = event.requestContext.authorizer?.userId as string;

        
        const result = await dynamo.send(
            new GetCommand({
                TableName: ORDERS_TABLE,
                Key: { orderId }
            })
        )

        if (!result.Item) {
            return notFound("Pedido no encontrado en la base de datos.")
        }

        if (result.Item.userId !== callerId) {
            return forbidden("Solo puedes verificar las ordenes que son de tu autoría.")
        }

        return ok({Order: result.Item})
        
    } catch (error) {
        console.error("Error al obtener el pedido", error)
        return internalError("Error al obtener el pedido.")

    }        

}

export const getOrder = withCors(handler);