
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"
import { v4 as uuidv4 } from "uuid"
import { dynamo } from "../lib/dynamodb"
import { badRequest, created } from "../lib/response"
import { invokeLambda, ordersFn, productFn } from "../lib/lambdaInvoke"
import { withCors } from "../common/cors"
import { Review } from "../types/review"

const REVIEWS_TABLE = process.env.REVIEWS_TABLE;

// Función para obtener información del producto desde el microservicio de productos para validar su existencia  
async function fetchProduct(productId: string): Promise <{productId: string; } | null> {
    try {
        const res = await invokeLambda<{ Product: { productId: string; } }>(
            productFn("Get"),
            { pathParameters: { id: productId } }
        )

        if (res.statusCode !== 200 || !res.body.Product) return null;
        return res.body.Product;

    } catch (error) {
        console.error("Error fetching product", error)
        return null
    }
}

/**
 * @ENDPOINT POST /reviews/{id}
 * @DESCRIPTION Permite crear una nueva reseña para un producto específico. El ID del producto se recibe como path parameter. El body debe contener el rating 
 * (número entre 1 y 5) y un comentario opcional. El userId se obtiene del authorizer. Se valida que el producto exista, que el usuario haya comprado el producto 
 * para evitar reseñas falsas, y que no haya creado una reseña previa para ese producto para evitar reseñas múltiples del mismo usuario. Si todo es válido, se crea 
 * la reseña y se guarda en la base de datos.
 */
export async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {

        const userId = event.requestContext.authorizer?.userId;
        const productId = event.pathParameters?.id;
        const body =JSON.parse(event.body ?? "{}");

        // Validamos que los datos recibidos sean correctos para insertar la reseña
        const { rating, comment } = body as { rating: number; comment: string };
        
        // Validación robusta para el comentario opcional (acepta string o undefined/omitido)
        if (
            !productId || 
            typeof rating !== "number" || 
            rating < 1 || 
            rating > 5 || 
            !Number.isInteger(rating) || 
            (comment !== undefined && typeof comment !== "string")
        ) {
            return badRequest("Los datos de la reseña no son válidos o el rating no está entre 1 y 5.")
        }

        // Validamos que el producto para el cual se quiere crear la reseña exista, para evitar reseñas huérfanas
        const product = await fetchProduct(productId);
        if (!product){
            return badRequest("El producto para el cual se quiere crear la reseña no existe.")
        }

        // Verificar si el usuario tiene una compra del producto que reseñará, para evitar reseñas falsas
        const purchaseRes = await invokeLambda<{ purchased: boolean }>(
            ordersFn("CheckPurchased"),
            { pathParameters: { id: productId }, requestContext: { authorizer: { userId } } }
        )

        if (!purchaseRes.body.purchased) {
            return badRequest("Solo los usuarios que han comprado el producto pueden crear una reseña.")
        }

        // Validación de review duplicada: Verificar si el usuario ya ha creado una 
        // reseña para este producto, para evitar reseñas múltiples del mismo usuario
        const existingReviewCheck = await dynamo.send(
            new QueryCommand({
                TableName: REVIEWS_TABLE,
                IndexName: "ProductReviewIndex", // Usamos el GSI que busca por producto
                KeyConditionExpression: "productId = :productId",
                FilterExpression: "userId = :userId", // Filtramos para ver si este usuario en específico ya está ahí
                ExpressionAttributeValues: {
                    ":productId": productId,
                    ":userId": userId!
                }
            })
        );

        if (existingReviewCheck.Items && existingReviewCheck.Items.length > 0) {
            return badRequest("Ya has creado una reseña para este producto.")
        }

        // Si el producto existe, se procede a crear la reseña
        const now = new Date().toISOString();
        const review: Review = {
            reviewId: uuidv4(),
            userId: userId!,
            productId,
            rating,
            comment,
            createdAt: now,
            updatedAt: now
        }

        await dynamo.send(
            new PutCommand({
                TableName: REVIEWS_TABLE!,
                Item: review
            })
        )

        return created({ message: "Reseña creada exitosamente", review })

    } catch (error) {
      console.error("Error al crear la reseña", error)
      return{
        statusCode: 500,
        body: JSON.stringify({message: "Hubo un error al crear la reseña."})
      }
    }
}

export const createReview = withCors(handler);