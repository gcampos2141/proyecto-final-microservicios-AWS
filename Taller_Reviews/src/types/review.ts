// Archivo para definir la interfaz del objeto Review, que representa una reseña de un producto hecha por un usuario.
export interface Review {
    reviewId: string,
    userId: string,
    productId: string, 
    comment: string,
    createdAt: string,
    updatedAt: string,
    rating: number
}