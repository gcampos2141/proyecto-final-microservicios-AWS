// Archivo encargado de definir las interfaces y tipos relacionados con las órdenes en el sistema, incluyendo la estructura de los items de una orden y la propia orden, con sus propiedades y estados posibles.
export interface OrderItem{
    productId: string,
    quantity: number,
    price: number,
}

export interface Order{
    orderId: string;
    userId: string;
    items: OrderItem [];
    total: number;
    status: "pending" | "confirmed" | "completed" | "canceled";
    createdAt: string;
    updatedAt: string;
}