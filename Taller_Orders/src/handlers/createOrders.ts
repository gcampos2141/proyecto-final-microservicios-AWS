import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import {PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb"
import { v4 as uuidv4 } from "uuid"
import { dynamo } from "../lib/dynamodb"
import { badRequest, created, internalError } from "../lib/response"
import { Order, OrderItem } from "../types/order"
import { invokeLambda, productFn } from "../lib/lambdaInvoke"
import { withCors } from "../common/cors"

const ORDERS_TABLE = process.env.ORDERS_TABLE;

async function fetchProduct(productId: string): Promise <{productId: string; price: number; stock: number; name: string } | null> {
    try {
        const res = await invokeLambda<{ Product: { productId: string; price: number; stock: number; name: string; } }>(
            productFn("Get"),
            { pathParameters: { id: productId } }
        )

        console.log("Respuesta del lambda:", JSON.stringify(res));  

        if (res.statusCode !== 200 || !res.body.Product) return null;
        return res.body.Product;

    } catch (error) {
        console.error("Error fetching product", error)
        return null
    }
}

async function decrementStock(productId: string, quantity: number): Promise <boolean>{
    try {
        const res = await invokeLambda(
            productFn("UpdateStock"), 
            { 
                pathParameters: { id: productId }, 
                body: JSON.stringify({ quantity }) 
            }
        )
        return res.statusCode === 200;
    } catch (error) {
        return false
    }
}


export async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {

        const userId = event.requestContext.authorizer?.userId;
        const body =JSON.parse(event.body ?? "{}");
        const { items } = body as { items: Array<{productId: string, quantity: number, price: number}> };

        if (!items || !Array.isArray(items) || items.length === 0) {
            return badRequest("Se requieren de items para crear una orden")
        }

        for (const item of items) {
            if (!item.productId || typeof item.quantity !== "number" || item.quantity < 1 || !Number.isInteger(item.quantity)) {
                return badRequest("Los items no cumplen con las validaciones necesarias para ser procesados")
            }
        }

        const resolvedItems : OrderItem[] = [];

        for (const item of items) {
            const product = await fetchProduct(item.productId);
            if (!product) {
                return badRequest(`El producto ${item.productId} no existe, `)
            }

            if (product.stock < item.quantity) {
                return badRequest(`Stock insuficiente para ${product.name}.`);
            }

            resolvedItems.push({
                productId: item.productId,
                quantity: item.quantity,
                price: product.price,
            })
        }

        const total = resolvedItems.reduce((sum, i) => sum + i.price * i.quantity, 0)

        const now = new Date().toISOString()

        const order: Order = {
            orderId: uuidv4(),
            userId,
            items,
            total,
            status: "pending",
            createdAt: now,
            updatedAt: now
        }

        await dynamo.send(
            new PutCommand({
                TableName: ORDERS_TABLE,
                Item: order
            })
        )

        const decremented: OrderItem[] = [];

        for(const item of resolvedItems){
            const success = await decrementStock( item.productId, item.quantity );
            if (!success) {
                console.error(`Fallo al decrementarse el stock del producto ${ item.productId }`)
                await dynamo.send(
                    new UpdateCommand({
                        TableName: ORDERS_TABLE,
                        Key: { orderId: order.orderId },
                        UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
                        ExpressionAttributeNames: { "#status": "status" },
                        ExpressionAttributeValues: {
                            ":status" : "canceled",
                            ":updatedAt": new Date().toISOString()
                        }
                    })
                )
                return internalError("No se pudo reservar el stock para uno o más productos. La orden ha sido cancelada")
            }
            decremented.push(item);
        }

        return created({order})

    } catch (error) {
      console.error("Error al crear la orden", error)
      return{
        statusCode: 500,
        body: JSON.stringify({message: "Hubo un error al crear la orden"})
      }
    }
}

export const createOrders = withCors(handler);