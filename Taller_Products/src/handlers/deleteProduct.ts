import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import { DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb"
import { dynamo } from "../lib/dynamodb"
import { forbidden, internalError, notFound, ok } from "../lib/response"
import { withCors } from "../common/cors"

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE

/**
 * @ENDPOINT DELETE /products/{id}
 * @DESCRIPTION Permite eliminar un producto existente. El producto a eliminar se identifica por su ID, que se recibe como parámetro en la ruta. 
 * Solo el vendedor que creó el producto puede eliminarlo, por lo que se valida que el userId del authorizer coincida con el sellerId del producto. 
 * Si el producto no existe o el usuario no tiene permisos para eliminarlo, se retorna un error adecuado. Si la eliminación es exitosa, se retorna 
 * un mensaje de confirmación.
 */
export async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {
        const productId = event.pathParameters?.id;
        if (!productId) {
            return notFound('El producto no existe.');
        }

        const callerId = event.requestContext.authorizer?.userId;
         
        const existing = await dynamo.send(
            new GetCommand({
                TableName: PRODUCTS_TABLE,
                Key: { productId }
            })
        )

        if (!existing.Item) {
            return notFound("El producto no fue encontrado en la base de datos.")
        }

        if (existing.Item.sellerId !== callerId) {
            return forbidden("Solo puedes borrar el producto de tu propia autoria.")   
        }

        await dynamo.send(
            new DeleteCommand({
                TableName: PRODUCTS_TABLE,
                Key: { productId },
            })
        )

        return ok({ message: "Producto Eliminado Existosamente." })
        
    } catch (error) {
        console.error("Error al tratar de eliminar el producto", error)
        return internalError("Error al tratar de eliminar el producto.")

    }        

}

export const deleteProduct = withCors(handler);