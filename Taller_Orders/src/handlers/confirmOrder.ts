import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb"
import { dynamo } from "../lib/dynamodb"
import { badRequest, forbidden, internalError, notFound, ok } from "../lib/response"
import { Order } from "../types/order"
import { invokeLambda, productFn } from "../lib/lambdaInvoke"
import { withCors } from "../common/cors"

const ORDERS_TABLE = process.env.ORDERS_TABLE

export async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {
        const orderId = event.pathParameters?.id;
        if (!orderId) {
            return notFound('El pedido no fue encontrado');
        }

        const callerId = event.requestContext.authorizer?.userId as string;

        
        const existing = await dynamo.send(
            new GetCommand({
                TableName: ORDERS_TABLE,
                Key: { orderId }
            })
        )

        if (!existing.Item) {
            return notFound("Pedido no encontrado en la base de datos.")
        }

        const order = existing.Item as Order;

        // Solo se pueden confirmar ordenes con el estatus 'pending' 
        if (order.status !== "pending") {
            return badRequest(`No se puede confirmar una orden con el status ${order.status}` )
        }

        const res = await invokeLambda<{ products: Array<{ productId: string }> }>(
            productFn("ListBySeller"),
            { pathParameters: { sellerId: callerId } }
        );

        const sellerProductIds = new Set(
            res.statusCode === 200 ? res.body.products.map((p)=> p.productId) : []
        );

        const isSeller = order.items.some((i) => sellerProductIds.has(i.productId));

        if (!isSeller) {
            return forbidden("Solo un vendedor con productos en esta orden puede confirmarla");
        }

        await dynamo.send(
            new UpdateCommand({
                TableName: ORDERS_TABLE,
                Key: { orderId },
                UpdateExpression: "SET #status = :status, updatedAt= :updatedAt",
                ExpressionAttributeNames: { "#status" : "status" },
                ExpressionAttributeValues:{
                    ":status" : "confirmed",
                    ":updatedAt" : new Date().toISOString()
                }
            })
        )

        return ok({Message: "Orden Confirmada"})
        
    } catch (error) {
        console.error("Error al confirmar el pedido", error)
        return internalError("Error al confirmar el pedido")

    }        

}

export const confirmOrder = withCors(handler);