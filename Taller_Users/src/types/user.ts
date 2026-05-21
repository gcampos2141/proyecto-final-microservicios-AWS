// Archivo para definir la interfaz del usuario que se usará en el proyecto.
export interface User{
    userId: string,
    email: string,
    password: string, 
    name: string,
    role: "buyer" | "seller",
    createdAt: string,
    updatedAt: string 
}