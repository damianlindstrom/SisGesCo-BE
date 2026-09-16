import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Catálogos base, tomados tal cual de tus hojas "Categoria" (Base de
// Clientes) y de las formas de pago que aparecen en Ventas/Compras/Gastos.
async function main() {
  await prisma.categoriaCliente.createMany({
    data: [
      { nombre: 'Resp. Inscripto' },
      { nombre: 'Consumidor Final' },
      { nombre: 'Cliente con c/corriente' },
    ],
    skipDuplicates: true,
  });

  await prisma.formaPago.createMany({
    data: [
      { nombre: 'Efectivo' },
      { nombre: 'Transferencia' },
      { nombre: 'Cuenta Corriente' },
    ],
    skipDuplicates: true,
  });

  // Alícuotas de referencia — AJUSTAR según la situación fiscal real
  // del negocio antes de usar el reporte impositivo en serio.
  await prisma.impuesto.createMany({
    data: [
      { nombre: 'IVA', alicuota: 0.21 },
      { nombre: 'IIBB', alicuota: 0.03 },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
