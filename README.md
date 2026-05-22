# 🛒 AmazonLite — Proyecto Final: Microservicios en AWS
**Facultad de Informática · UAQ · Taller de Desarrollo de Microservicios en AWS**  
**Desarrollado por:** 
- *Gabriel Martín Campos Aguilar — 325844*
- *Francisco Enrique Figueroa Hernandez — 315233*

---

## 📋 Descripción general

AmazonLite es una plataforma de comercio electrónico construida con una arquitectura de **microservicios serverless** sobre AWS. Simula una tienda en línea donde coexisten compradores y vendedores, con flujos completos de registro, autenticación, gestión de productos, órdenes y reseñas.

Cada módulo es un stack independiente desplegado con **Serverless Framework v4**, todos compartiendo un único API Gateway central gestionado por el módulo Gateway.

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────┐
│                   API Gateway (REST)                 │
│              taller-gateway-{stage}                  │
│         JWT Authorizer · API Key · Throttling        │
└────────┬──────────┬──────────┬──────────┬───────────┘
         │          │          │          │
    ┌────▼───┐ ┌────▼───┐ ┌───▼────┐ ┌───▼─────┐
    │ Users  │ │Products│ │ Orders │ │ Reviews │
    │ Lambda │ │ Lambda │ │ Lambda │ │  Lambda │
    └────┬───┘ └────┬───┘ └───┬────┘ └───┬─────┘
         │          │         │           │
    ┌────▼───┐ ┌────▼───┐ ┌──▼─────┐ ┌──▼──────┐
    │DynamoDB│ │DynamoDB│ │DynamoDB│ │ DynamoDB│
    │ Users  │ │Products│ │ Orders │ │ Reviews │
    └────────┘ └────────┘ └────────┘ └─────────┘
```

### Comunicación inter-microservicio

Orders invoca directamente lambdas de Products (para validar stock y precios).  
Reviews invoca lambdas de Products (para verificar existencia) y de Orders (para verificar compra).

---

## 📦 Módulos

| Módulo | Servicio Serverless | Tabla DynamoDB |
|---|---|---|
| Gateway | `taller-gateway` | — |
| Usuarios | `taller-users` | `taller-users-{stage}-users` |
| Productos | `taller-products` | `taller-products-{stage}-products` |
| Órdenes | `taller-orders` | `taller-orders-{stage}-orders` |
| Reseñas | `taller-reviews` | `taller-reviews-{stage}-reviews` |

---

## 🔐 Autenticación

El sistema usa **JWT (JSON Web Tokens)** con dos tokens:

- **Access Token** — Vida corta. Se envía en el header `Authorization: Bearer <token>` en cada request a endpoints protegidos.
- **Refresh Token** — Vida de 7 días, almacenado en DynamoDB con TTL automático. Se usa para obtener nuevos access tokens sin re-autenticarse.

El Lambda Authorizer (`taller-{stage}-Authorizer`) valida el token en cada request y propaga `userId` y `role` al contexto del handler.

---

## 🚀 Endpoints

### 🔑 Gateway — `/gateway`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/gateway/ping` | No | Health check del API |

---

### 👤 Usuarios — `/users`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/users/register` | No | Registrar nuevo usuario |
| POST | `/users/login` | No | Iniciar sesión |
| GET | `/users/{id}` | ✅ JWT | Obtener perfil de usuario |
| PUT | `/users/{id}` | ✅ JWT | Actualizar datos del usuario |
| DELETE | `/users/{id}` | ✅ JWT | Eliminar cuenta |

#### POST `/users/register`
```json
// Request body
{
  "email": "usuario@ejemplo.com",
  "password": "MiPassword123",
  "name": "Usuario",
  "role": "buyer"       // "buyer" | "seller" (default: "buyer")
}

// Response 200
{
  "userPublic": {
    "userId": "uuid",
    "email": "usuario@ejemplo.com",
    "name": "Usuario",
    "role": "buyer",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### POST `/users/login`
```json
// Request body
{
  "email": "usuario@ejemplo.com",
  "password": "MiPassword123"
}

// Response 200
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 📦 Productos — `/products`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/products` | ✅ JWT | Crear producto |
| GET | `/products` | No | Listar todos los productos |
| GET | `/products/{id}` | No | Obtener producto por ID |
| GET | `/products/users/{sellerId}` | No | Listar productos de un vendedor |
| PATCH | `/products/{id}/stock` | No | Actualizar stock (uso interno) |
| PUT | `/products/{id}` | ✅ JWT | Actualizar producto |
| DELETE | `/products/{id}` | ✅ JWT | Eliminar producto |

#### POST `/products`
```json
// Request body
{
  "name": "Lentes RayBan",
  "description": "Lentes de sol polarizados",
  "price": 2200,
  "stock": 10
}

// Response 201
{
  "Product": {
    "productId": "uuid",
    "sellerId": "uuid-del-vendedor",
    "name": "Lentes RayBan",
    "description": "Lentes de sol polarizados",
    "price": 2200,
    "stock": 10,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

### 🛒 Órdenes — `/orders`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/orders` | ✅ JWT | Crear orden |
| GET | `/orders/{id}` | ✅ JWT | Obtener orden por ID |
| GET | `/orders/user/{userId}` | ✅ JWT | Listar órdenes de un usuario |
| POST | `/orders/{id}/cancel` | ✅ JWT | Cancelar orden |
| POST | `/orders/{id}/confirm` | ✅ JWT | Confirmar orden |
| GET | `/orders/{id}/check-purchased` | ✅ JWT | Verificar si se compró un producto (uso interno) |

#### POST `/orders`
```json
// Request body
{
  "items": [
    { "productId": "uuid-producto", "quantity": 2 }
  ]
}

// Response 201
{
  "order": {
    "orderId": "uuid",
    "userId": "uuid-comprador",
    "items": [
      { "productId": "uuid-producto", "quantity": 2, "price": 2200 }
    ],
    "total": 4400,
    "status": "pending",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

#### Ciclo de vida de una orden

```
pending ──── confirm (vendedor) ──▶ confirmed
   │
   └────── cancel (comprador o vendedor) ──▶ canceled
```

**Reglas de negocio:**
- Un comprador **no puede** crear una orden con sus propios productos.
- Solo el **vendedor** cuyos productos estén en la orden puede confirmarla.
- La orden puede ser cancelada por el **comprador** o por un **vendedor** con productos en ella.
- Al crear la orden, el stock se decrementa automáticamente. Si falla, la orden se cancela.

---

### ⭐ Reseñas — `/reviews`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/reviews/{id}` | ✅ JWT | Crear reseña para un producto |
| GET | `/reviews/{id}` | No | Listar reseñas de un producto |
| DELETE | `/reviews/{id}` | ✅ JWT | Eliminar una reseña |

#### POST `/reviews/{productId}`
```json
// Request body
{
  "rating": 5,          // Entero entre 1 y 5
  "comment": "Excelente producto, muy recomendado."
}

// Response 201
{
  "message": "Reseña creada exitosamente",
  "review": {
    "reviewId": "uuid",
    "userId": "uuid-comprador",
    "productId": "uuid-producto",
    "rating": 5,
    "comment": "Excelente producto, muy recomendado.",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Reglas de negocio:**
- Solo usuarios que hayan **comprado** el producto pueden reseñarlo.
- Cada usuario puede dejar **máximo una reseña** por producto.
- Las reseñas se ordenan de más nueva a más antigua gracias al GSI `ProductReviewIndex`.

---

## 🗄️ Modelos de datos

### User
```typescript
{
  userId: string;       // PK
  email: string;        // GSI: EmailIndex
  password: string;     // bcrypt hash
  name: string;
  role: "buyer" | "seller";
  createdAt: string;
  updatedAt: string;
}
```

### Product
```typescript
{
  productId: string;    // PK
  sellerId: string;     // GSI: sellerIndex
  name: string;
  description: string;
  price: number;
  stock: number;
  createdAt: string;
  updatedAt: string;
}
```

### Order
```typescript
{
  orderId: string;      // PK
  userId: string;       // GSI: UserOrderIndex
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  status: "pending" | "confirmed" | "completed" | "canceled";
  createdAt: string;
  updatedAt: string;
}
```

### Review
```typescript
{
  reviewId: string;     // PK
  productId: string;    // GSI: ProductReviewIndex (HASH)
  createdAt: string;    // GSI: ProductReviewIndex (RANGE)
  userId: string;
  rating: number;       // 1 - 5
  comment: string;
  updatedAt: string;
}
```

---

## ⚙️ Requisitos previos

- Node.js 22.x
- Serverless Framework v4 (`npm install -g serverless`)
- AWS CLI configurado con credenciales válidas
- Parámetros en AWS SSM Parameter Store:
  - `/taller/{stage}/jwt-secret`
  - `/taller/{stage}/jwt-refresh-secret`

---

## 🚢 Despliegue

Los módulos deben desplegarse **en orden** porque cada uno depende de los exports del anterior:

```bash
# 1. Gateway (debe desplegarse primero — exporta el RestApiId y el AuthorizerId)
cd Taller_Gateway
npm install
npx serverless deploy --stage dev

# 2. Users
cd ../Taller_Users
npm install
npx serverless deploy --stage dev

# 3. Products
cd ../Taller_Products
npm install
npx serverless deploy --stage dev

# 4. Orders (depende de Products para invocación inter-lambda)
cd ../Taller_Orders
npm install
npx serverless deploy --stage dev

# 5. Reviews (depende de Products y Orders)
cd ../Taller_Reviews
npm install
npx serverless deploy --stage dev
```

> **Nota:** Sustituye `dev` por el stage que corresponda (`local`, `prod`, etc.).

---

## 🔧 Variables de entorno

Cada módulo lee su configuración de entorno desde `./config/config-{stage}.json`:

```json
{
  "CORS_ORIGIN": "https://tu-frontend.com"
}
```

Las variables sensibles (`JWT_SECRET`, `JWT_REFRESH_SECRET`) se leen desde **AWS SSM Parameter Store** y nunca se almacenan en el repositorio.

---

## 🛡️ Seguridad

- Las contraseñas se almacenan con hash **bcrypt** (salt rounds: 10).
- Todos los endpoints sensibles requieren **JWT válido** en el header `Authorization`.
- El API Gateway cuenta con **throttling** (10 req/s, burst de 20) y un límite mensual de **10,000 requests** por API Key.
- Los vendedores **no pueden** comprar sus propios productos ni confirmar órdenes ajenas a sus productos.
- Las reseñas requieren compra verificada para evitar fraude.

---

## 📁 Estructura del repositorio

```
proyecto-final-microservicios-AWS/
├── Taller_Gateway/
│   ├── serverless.yml
│   ├── src/
│   │   ├── handlers/
│   │   │   ├── authorizer.ts
│   │   │   └── ping.ts
│   │   ├── common/cors.ts
│   │   └── lib/jwt.ts
│   └── config/
├── Taller_Users/
│   ├── serverless.yml
│   ├── src/
│   │   ├── handlers/
│   │   │   ├── register.ts
│   │   │   ├── login.ts
│   │   │   ├── getUser.ts
│   │   │   ├── updateUser.ts
│   │   │   └── deleteUser.ts
│   │   ├── common/cors.ts
│   │   ├── lib/
│   │   │   ├── dynamodb.ts
│   │   │   ├── jwt.ts
│   │   │   └── response.ts
│   │   └── types/user.ts
│   └── config/
├── Taller_Products/
│   ├── serverless.yml
│   ├── src/
│   │   ├── handlers/
│   │   │   ├── createProducts.ts
│   │   │   ├── getProduct.ts
│   │   │   ├── listAllProducts.ts
│   │   │   ├── listProductsBySeller.ts
│   │   │   ├── updateStock.ts
│   │   │   ├── updateProduct.ts
│   │   │   └── deleteProduct.ts
│   │   ├── common/cors.ts
│   │   ├── lib/
│   │   │   ├── dynamodb.ts
│   │   │   └── response.ts
│   │   └── types/product.ts
│   └── config/
├── Taller_Orders/
│   ├── serverless.yml
│   ├── src/
│   │   ├── handlers/
│   │   │   ├── createOrders.ts
│   │   │   ├── getOrder.ts
│   │   │   ├── listOrdersbyUserId.ts
│   │   │   ├── cancelOrder.ts
│   │   │   ├── confirmOrder.ts
│   │   │   └── checkProductPurchased.ts
│   │   ├── common/cors.ts
│   │   ├── lib/
│   │   │   ├── dynamodb.ts
│   │   │   ├── lambdaInvoke.ts
│   │   │   └── response.ts
│   │   └── types/order.ts
│   └── config/
└── Taller_Reviews/
    ├── serverless.yml
    ├── src/
    │   ├── handlers/
    │   │   ├── createReview.ts
    │   │   ├── listAllfromProduct.ts
    │   │   └── deleteReview.ts
    │   ├── common/cors.ts
    │   ├── lib/
    │   │   ├── dynamodb.ts
    │   │   ├── lambdaInvoke.ts
    │   │   └── response.ts
    │   └── types/review.ts
    └── config/
```

---
