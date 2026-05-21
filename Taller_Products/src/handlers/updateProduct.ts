import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import { GetCommand,  UpdateCommand } from "@aws-sdk/lib-dynamodb"
import { dynamo } from "../lib/dynamodb"
import { badRequest, forbidden, internalError, notFound, ok, unauthorized } from "../lib/response"
import { withCors } from "../common/cors"

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE

/**
 * @ENDPOINT PUT /products/{id}
 * @DESCRIPTION Permite actualizar los detalles de un producto existente. El producto a actualizar se identifica por su ID, que se recibe como parámetro en la ruta. 
 * Solo el vendedor que creó el producto puede actualizarlo, por lo que se valida que el userId del authorizer coincida con el sellerId del producto. 
 * En el cuerpo de la solicitud se pueden incluir los campos a actualizar: name, description, price y stock. Se validan los datos recibidos para asegurarse de que cumplen con los requisitos 
 * (por ejemplo, price debe ser un número positivo y stock debe ser un entero no negativo). Si el producto no existe o el usuario no tiene permisos para actualizarlo, se retorna un error adecuado. 
 * Si la actualización es exitosa, se retorna un mensaje de confirmación.
 */
export async function handler(event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> {
    try {
        const productId = event.pathParameters?.id;
        if (!productId) {
            return notFound('El producto no fue encontrado.');
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
            return forbidden("Solo puedes actualizar el producto de tu propia autoria.")   
        }

        const body =  JSON.parse(event.body ?? "{}")
        const { name, description, price, stock } = body;
        
        if (!name || !description || !price || !stock ) {
            return badRequest("Se requieren de todos los elementos para poder crear el producto.")
        }

        if (typeof price !==  "number" || price < 0) {
            return badRequest("El precio tiene que ser un número mayor a 0.");
        }
        
        if (typeof stock !==  "number" || stock < 0 || !Number.isInteger(stock)) {
            return badRequest("El stock tiene que ser un número mayor a 0 y debe ser un número.");
        }

        const now = new Date().toISOString();

        const update: string [] = ['updatedAt = :updatedAt'];
        const expressionAttributeValues: Record<string, unknown> = { ':updatedAt': now };
        const expressionAttributeNames: Record<string, string> = {};

        // --------------------------------------------------------------------
        // Solo se incluyen en la actualización los campos que fueron enviados en el cuerpo de la solicitud, 
        // lo que permite actualizaciones parciales sin necesidad de enviar todos los datos del producto cada vez.
        // --------------------------------------------------------------------
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
        
        // 
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

        return ok({ message: "Producto Actualizado Existosamente." })
        
    } catch (error) {
        console.error("Error al obtener el usuario", error)
        return internalError("Error al obtener el usuario.")

    }        

}

export const updateProduct = withCors(handler);