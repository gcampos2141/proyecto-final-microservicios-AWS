import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb"
import { dynamo } from "../lib/dynamodb"
import { badRequest, forbidden, internalError, notFound, ok } from "../lib/response"
import { Order } from "../types/order"
import { invokeLambda, productFn } from "../lib/lambdaInvoke"
import { withCors } from "../common/cors"

const ORDERS_TABLE = process.env.ORDERS_TABLE
/**
 * @ENDPOINT POST /orders/{id}/cancel
 * @DESCRIPTION Permite cancelar una orden existente. Solo el comprador que realizó la orden o un vendedor que tenga productos en la orden 
 * pueden cancelarla. Cambia el estado de la orden a "canceled" y actualiza la fecha de actualización.
 */
async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
        const orderId = event.pathParameters?.id;
        if (!orderId) return notFound("El pedido no fue encontrado.");

        const callerId = event.requestContext.authorizer?.userId as string;

        const existing = await dynamo.send(
            new GetCommand({ TableName: ORDERS_TABLE, Key: { orderId } })
        );

        if (!existing.Item) return notFound("Pedido no encontrado en la base de datos.");

        const order = existing.Item as Order;

        if (order.status === "canceled") {
            return badRequest("Esta orden ya fue cancelada.");
        }

        // =========================================================================
        // VALIDACIÓN DE ROLES (REGLA DE NEGOCIO EN COMMERCE)
        // El comprador puede cancelar directo. Si no es el comprador, se consulta 
        // el microservicio de Productos para verificar si el llamante es un vendedor 
        // afectado.
        // =========================================================================
        const isBuyer = order.userId === callerId;

        let sellerProductIds = new Set<string>();

        if (!isBuyer) {
            const res = await invokeLambda<{ products: Array<{ productId: string }> }>(
                productFn("ListBySeller"),                     
                { pathParameters: { sellerId: callerId } }
            );
            sellerProductIds = new Set(
                res.statusCode === 200 ? res.body.products.map((p) => p.productId) : []
            );
        }

        const isSeller = order.items.some((i) => sellerProductIds.has(i.productId));

        if (!isBuyer && !isSeller) {
            return forbidden("Solo puedes cancelar una orden si eres el comprador o un vendedor con productos en esta orden.");
        }

        await dynamo.send(
            new UpdateCommand({
                TableName: ORDERS_TABLE,
                Key: { orderId },
                UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
                ExpressionAttributeNames: { "#status": "status" },
                ExpressionAttributeValues: {
                    ":status": "canceled",
                    ":updatedAt": new Date().toISOString()
                }
            })
        );

        return ok({ message: "Orden cancelada." });

    } catch (error) {
        console.error("Error al cancelar el pedido", error);
        return internalError("Error al cancelar el pedido.");
    }
}

export const cancelOrder = withCors(handler);