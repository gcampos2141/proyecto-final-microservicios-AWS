// Configuración CORS para permitir que el frontend pueda consumir las APIs sin problemas de CORS
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

type Handler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

// Se definen los headers CORS permitidos para que el frontend pueda enviar las solicitudes correctamente al backend sin problemas de CORS.
const CORS_HEADERS = [
    "Content-Type",
    "Authorization",
    "X-Api-Key",
    "X-Amz-Date",
    "X-Amz-Security-Token"

].join(", ");

// Función de orden superior que envuelve los handlers para agregar los headers CORS necesarios a las respuestas
export function withCors(handler: Handler): Handler {
    return async function (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
        const allowedOrigins = (process.env.CORS_ORIGIN ?? "").split(",").map(o => o.trim()).filter(Boolean);
        
        const origin = event.headers?.origin ?? event.headers?.Origin ?? "";
        
        const allowedOrigin = allowedOrigins.includes(origin) ? origin : "";

        const result = await handler(event);

        return {
            ...result,
            headers: {
                ...result.headers,
                "Access-Control-Allow-Origin": allowedOrigin,
                "Access-Control-Allow-Headers": CORS_HEADERS,
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            }
        }
    }
}