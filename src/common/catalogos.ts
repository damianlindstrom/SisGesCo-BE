import { prisma } from './prisma-client';

/**
 * El front manda la forma de pago como texto simple (ej: "Efectivo").
 * Esta función centraliza el mapeo texto -> FormaPago.id, creándola si
 * es la primera vez que se usa. La usan Ventas, Compras y Gastos por
 * igual — nadie repite este find-or-create a mano.
 */
export async function obtenerOCrearFormaPago(nombre: string): Promise<number> {
  const formaPago = await prisma.formaPago.upsert({
    where: { nombre },
    update: {},
    create: { nombre },
  });
  return formaPago.id;
}
