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