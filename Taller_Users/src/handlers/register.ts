import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import { DynamoDBDocument, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"
import bcrypt from "bcryptjs"
import { v4 as uuidv4 } from "uuid"
import { dynamo } from "../lib/dynamodb"
import { badRequest, ok } from "../lib/response"
import { User } from "../types/user"
import { withCors } from "../common/cors"

const USERS_TABLE = process.env.USERS_TABLE

export async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {
        const body =  JSON.parse(event.body ?? "{}")
        const {email, password, name, role = "buyer" } = body 

        if (!email || !password || !name) {
            return badRequest("El Email, password o el nombre son requeridos")
        }

        const existing = await dynamo.send(
            new QueryCommand({
                TableName: USERS_TABLE,
                IndexName: "EmailIndex",
                KeyConditionExpression: "email = :email",
                ExpressionAttributeValues: { ":email": email }
            })
        )

        console.log('usuario existe: ', existing);

        if (existing.Items && existing.Items.length > 0) {
            return badRequest("Email ya se encontraba registrado")
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const now = new Date().toISOString();

        const user: User = {
            userId: uuidv4(),
            email,
            password: hashedPassword, 
            name,
            role,
            createdAt: now,
            updatedAt: now 
        }

        try {
            await dynamo.send(new PutCommand({TableName: USERS_TABLE, Item: user}));
        } catch (error) {
            console.error("Error al registrar el usuario", error)
            throw new Error;
        }
        const { password: _, ...userPublic } = user

        return ok({userPublic})

    } catch (error) {
      console.error("Error al registrar el usuario", error)
      return{
        statusCode: 500,
        body: JSON.stringify({message: "Hubo un error al registrar al usuario"})
      }
    }
}

export const register = withCors(handler);