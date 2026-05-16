import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import {PutCommand } from "@aws-sdk/lib-dynamodb"
import { v4 as uuidv4 } from "uuid"
import { dynamo } from "../lib/dynamodb"
import { badRequest, created, forbidden, ok } from "../lib/response"
import { Product } from "../types/product"
import { withCors } from "../common/cors"

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;

export async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {

        const callerId = event.requestContext.authorizer?.userId;
        const callerRole = event.requestContext.authorizer?.role;

        if (callerRole !== "seller") {
            return forbidden("Solo los vendedores pueden crear un producto")
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

        const now  = new Date().toISOString()

        const product : Product = {
            productId: uuidv4(),
            sellerId: callerId,
            name,
            description,
            price,
            stock,
            createdAt: now,
            updatedAt: now
        } 

        await dynamo.send(
            new PutCommand({
                TableName: PRODUCTS_TABLE,
                Item: product
            })
        )

            
        return created({ product })

    } catch (error) {
      console.error("Error al crear el producto", error)
      return{
        statusCode: 500,
        body: JSON.stringify({message: "Hubo un error al crear el producto"})
      }
    }
}

export const createProducts = withCors(handler);