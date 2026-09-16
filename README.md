# Sisges Backend

API REST en Node + TypeScript + Express + Prisma (MySQL), migrada del
sistema original en Google Apps Script.

## Setup

```bash
npm install
cp .env.example .env          # ajustá DATABASE_URL si no usás el docker-compose
docker compose up -d          # levanta MySQL local
npx prisma migrate dev --name init
npx prisma db seed            # carga catálogos base (categorías, formas de pago)
npm run dev                   # http://localhost:3000
```

## Estructura

```
src/
  common/          → sobre de respuesta { ok, data|error }, manejo de errores,
                     cliente Prisma compartido
  modules/
    productos/     → controller + service (patrón a repetir en cada módulo)
    ventas/        → (pendiente)
    compras/       → (pendiente)
    gastos/        → (pendiente)
    reportes/      → (pendiente)
  app.ts           → arma express + monta routers
  server.ts        → arranca el server
prisma/
  schema.prisma    → modelo de datos completo
  seed.ts          → catálogos base
```

## Convención de cada módulo

1. `*.service.ts`: lógica de negocio + acceso a datos vía Prisma. Nunca
   devuelve `res` de Express — solo objetos de dominio.
2. `*.controller.ts`: valida el body con `zod`, llama al service, envuelve
   la respuesta con `ok(...)` del `common/api-response.ts`. Cualquier error
   se resuelve solo con `asyncHandler` — no hay que repetir try/catch.
3. Se monta en `app.ts` con `app.use('/api/<módulo>', router)`.

Todas las respuestas de la API, siempre, tienen esta forma:
```json
{ "ok": true, "data": { ... } }
{ "ok": false, "error": "mensaje" }
```
