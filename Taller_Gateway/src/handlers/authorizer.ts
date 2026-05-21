// Se implementa un authorizer personalizado para validar el token de acceso en cada solicitud a los endpoints protegidos.
import {
    APIGatewayTokenAuthorizerHandler,
    APIGatewayAuthorizerResult
} from "aws-lambda"
import { verifyAccessToken } from "../lib/jwt"

// Función auxiliar para generar la política de autorización que se retornará al API Gateway después de validar el token de acceso.
const generatePolicy = (
    principalId: string, 
    effect: "Allow" | "Deny",
    resource: string,
    context?: Record<string, string>
):APIGatewayAuthorizerResult => ({
    principalId,
    policyDocument: {
        Version: "2012-10-17",
        Statement: [
            {
                Action: "execute-api:Invoke",
                Effect: effect, 
                Resource: resource 
            },
        ],
    },
    context
})

// El authorizer se encarga de extraer el token de acceso del encabezado Authorization, verificar su validez y 
// generar una política de autorización que permita o deniegue el acceso a los endpoints protegidos según 
// corresponda.
export const authorizer: APIGatewayTokenAuthorizerHandler = async(event) =>{
    const token = event.authorizationToken?.replace(/^Bearer\s+/i, "")
    if(!token){
        throw new Error('Unauthorized');
    }

    try{
        const payload = verifyAccessToken(token)
        // Se transformo de ARN esppecifico a un ARN con comodin general para permitir que el authorizer funcione 
        // aunque se agreguen nuevos endpoints, ya que de lo contrario se tendria que estar actualizando continuamente
        const arnParts = event.methodArn.split('/');
        const wildcardResource = `${arnParts[0]}/${arnParts[1]}/*/*`;
        
        return generatePolicy(payload.userId, "Allow", wildcardResource, {
            userId: payload.userId,
            role: payload.role
        })
    }
    catch{
        throw new Error("Unauthorized")
    }
}