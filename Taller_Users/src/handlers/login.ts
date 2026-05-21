import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import { DynamoDBDocument, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"
import bcrypt from "bcryptjs"
import { v4 as uuidv4 } from "uuid"
import { dynamo } from "../lib/dynamodb"
import { badRequest, internalError, ok, unauthorized } from "../lib/response"
import { User } from "../types/user"
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../lib/jwt"
import { withCors } from "../common/cors"

const USERS_TABLE = process.env.USERS_TABLE
const REFRESH_TOKEN_TABLE = process.env.REFRESH_TOKEN_TABLE

/**
 * @ENDPOINT POST /login
 * @DESCRIPTION Permite a un usuario iniciar sesión. Recibe email y password en el body. Valida que el email exista en la base de datos y que la contraseña sea correcta. 
 * Si las credenciales son válidas, genera un access token JWT con la información del usuario (userId, email, role) y un refresh token, guarda el refresh token en la base 
 * de datos con una expiración de 7 días y retorna ambos tokens. Si las credenciales no son válidas, retorna un error 401.
 */
export async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {
        const body = JSON.parse(event.body ?? "{}");
        const {email, password} = body;
    
        if ( !email || !password ) {
            return badRequest("Email y password son requeridos.")
        }
    
        const result = await dynamo.send(
            new QueryCommand({
                TableName: USERS_TABLE,
                IndexName: "EmailIndex",
                KeyConditionExpression: "email = :email",
                ExpressionAttributeValues: { ":email": email }
            })
        )
    
        const user = result.Items?.[0];
    
        if (!user) {
            return unauthorized("Invalid credentials.")
        }
    
        const validPassword = await bcrypt.compare(password, user.password)
    
        if (!validPassword) {
            return unauthorized("Invalid credentials.")
        }
    
        const payload = {
            userId: user.userId,
            email: user.email,
            role: user.role
        }
    
        const accessToken = generateAccessToken(payload)
        const refreshToken = generateRefreshToken(payload)
    
        const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
        try {
            await dynamo.send(
                new PutCommand({
                    TableName: REFRESH_TOKEN_TABLE,
                    Item: { token: refreshToken, userId: user.userId, expiresAt }
                })
            )
        } catch (error) {
            console.error("Error al guardar el refresh token", error)
            throw new Error("Error al guardar el refresh token");

        }
        return ok({ accessToken, refreshToken })
        
    } catch (error) {
        console.error("Error al iniciar sesión", error)
        return internalError("Hubo un error al iniciar sesión.")

    }        

}

export const login = withCors(handler);