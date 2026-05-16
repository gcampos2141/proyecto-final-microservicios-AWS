import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import { GetCommand,  UpdateCommand } from "@aws-sdk/lib-dynamodb"
import { dynamo } from "../lib/dynamodb"
import { badRequest, forbidden, internalError, notFound, ok, unauthorized } from "../lib/response"
import { withCors } from "../common/cors"

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE

export async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {
        const productId = event.pathParameters?.id;
        if (!productId) {
            return notFound('El producto no fue encontrado');
        }

        const callerId = event.requestContext.authorizer?.userId;
         
        const existing = await dynamo.send(
            new GetCommand({
                TableName: PRODUCTS_TABLE,
                Key: { productId }
            })
        )

        if (!existing.Item) {
            return notFound("El producto no fue encontrado en la base de datos")
        }

        if (existing.Item.sellerId !== callerId) {
            return forbidden("Solo puedes actualizar el producto de tu propia autoria")   
        }

        const body =  JSON.parse(event.body ?? "{}")
        const { name, description, price, stock } = body;
        
        if (!name || !description || !price || !stock ) {
            return badRequest("Se requieren de todos los elementos para poder crear el producto")
        }

        if (typeof price !==  "number" || price < 0) {
            return badRequest("El precio tiene que ser un número mayor a 0");
        }
        
        if (typeof stock !==  "number" || stock < 0 || !Number.isInteger(stock)) {
            return badRequest("El stock tiene que ser un número mayor a 0 y debe ser un número");
        }

        const now = new Date().toISOString();

        const update: string [] = ['updatedAt = :updatedAt'];
        const expressionAttributeValues: Record<string, unknown> = { ':updatedAt': now };
        const expressionAttributeNames: Record<string, string> = {};

        if (name) {
            update.push("#name = :name");
            expressionAttributeNames["#name"] = "name";
            expressionAttributeValues[":name"] = name;
        }

        if (description) {
            update.push("description = :description");
            expressionAttributeValues[":description"] = description;
        }

        if (price !== undefined) {
            update.push("price = :price");
            expressionAttributeValues[":price"] = price;
        }

        if (stock !== undefined) {
            update.push("stock = :stock");
            expressionAttributeValues[":stock"] = stock;
        }

        await dynamo.send(
            new UpdateCommand({
                TableName: PRODUCTS_TABLE,
                Key: { productId },
                UpdateExpression: `SET ${update.join(", ")}`,
                ExpressionAttributeValues: expressionAttributeValues,
                ...(Object.keys(expressionAttributeNames).length > 0 && {
                    ExpressionAttributeNames: expressionAttributeNames
                })
            })
        );

        return ok({ messsage: "Producto Actualizado Existosamente" })
        
    } catch (error) {
        console.error("Error al obtener el usuario", error)
        return internalError("Error al obtener el usuario")

    }        

}

export const updateProduct = withCors(handler);