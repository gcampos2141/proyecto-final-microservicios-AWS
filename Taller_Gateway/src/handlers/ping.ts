// Lambda para responder a un ping, se puede usar para verificar que la lambda esta funcionando correctamente
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"

export async function ping(event:APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    console.log('Evento desde una api', event);
    console.log('Hola desde una lambda');

    return{
        statusCode: 200,
        headers: { "context-type": "application/json" },
        body: JSON.stringify({
            success: true,
            message: "Hola desde la lambda Ping"
        })
    }
}