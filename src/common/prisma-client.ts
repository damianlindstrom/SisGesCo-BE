import { PrismaClient } from '@prisma/client';

// Instancia única compartida por todos los módulos — evita abrir una
// conexión nueva por request.
export const prisma = new PrismaClient();
