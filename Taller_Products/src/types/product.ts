// Definición de la interfaz para un producto
export interface Product{
    productId: string,
    sellerId: string,
    name: string,
    description: string,
    price: number,
    stock: number,
    createdAt: string,
    updatedAt: string
}