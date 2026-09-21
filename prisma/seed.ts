import { PrismaClient, TipoComprobante, EstadoComprobante } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando carga de datos iniciales (Seed)...');

  // 1. Categorías de Cliente
  const catInscripto = await prisma.categoriaCliente.upsert({
    where: { nombre: 'Resp. Inscripto' },
    update: {},
    create: { nombre: 'Resp. Inscripto' },
  });

  const catConsumidor = await prisma.categoriaCliente.upsert({
    where: { nombre: 'Consumidor Final' },
    update: {},
    create: { nombre: 'Consumidor Final' },
  });

  const catMonotributista = await prisma.categoriaCliente.upsert({
    where: { nombre: 'Monotributista' },
    update: {},
    create: { nombre: '' },
  });

  // 2. Formas de Pago
  const fpEfectivo = await prisma.formaPago.upsert({
    where: { nombre: 'Efectivo' },
    update: {},
    create: { nombre: 'Efectivo', descripcion: 'Pago en billetes' },
  });

  const fpTransferencia = await prisma.formaPago.upsert({
    where: { nombre: 'Transferencia' },
    update: {},
    create: { nombre: 'Transferencia bancaria / Mercado Pago' },
  });

  const fpCtaCte = await prisma.formaPago.upsert({
    where: { nombre: 'Cuenta Corriente' },
    update: {},
    create: { nombre: 'Venta fiada o en cuenta corriente' },
  });

  // 3. Impuestos
  const impIva = await prisma.impuesto.upsert({
    where: { nombre: 'IVA' },
    update: {},
    create: { 
      nombre: 'IVA', 
      alicuota: 0.2100, 
      enVentas: true, 
      enCompras: true, 
      enGastos: true,
      activo: true 
    },
  });

  const impIibb = await prisma.impuesto.upsert({
    where: { nombre: 'IIBB' },
    update: {},
    create: { 
      nombre: 'IIBB', 
      alicuota: 0.0300, 
      enVentas: true, 
      enCompras: true, 
      enGastos: true,
      activo: true 
    },
  });

  // 4. Proveedores de prueba
  const proveedor1 = await prisma.proveedor.create({
    data: {
      nombre: 'Distribuidora Mayorista S.A.',
      cuit: '30-71234567-9',
      categoria: 'Mayorista',
    },
  });

  // 5. Clientes de prueba
  const cliente1 = await prisma.cliente.create({
    data: {
      nombre: 'Juan Pérez',
      dniCuit: '20-33445566-3',
      categoriaId: catConsumidor.id,
      cuentaCorriente: false,
    },
  });

  // 6. Productos de prueba
  const producto1 = await prisma.producto.create({
    data: {
      nombre: 'Producto de Prueba A',
      rubro: 'General',
      tipo: 'Unidad',
      stock: 100,
      costo: 500.00,
      pctRespInsc: 1.50,
      pctConsFinal: 1.80,
      pctCtaCte: 2.00,
    },
  });

  // 7. Venta de prueba (con su respectivo impuesto IVA)
  const fechaActual = new Date();
  const ventaPrueba = await prisma.venta.create({
    data: {
      clienteId: cliente1.id,
      formaPagoId: fpTransferencia.id,
      nroComprobante: '0001-00000123',
      neto: 1652.89,
      noGravado: 0,
      detalle: {
        create: [
          {
            productoId: producto1.id,
            cantidad: 2,
            precioUnitario: 1000.00,
            costoUnitario: 500.00,
            subtotal: 2000.00,
          },
        ],
      },
      impuestos: {
        create: [
          {
            impuestoId: impIva.id,
            monto: 347.11, // IVA sobre 2000 total
          },
        ],
      },
    },
  });

  // 8. Compra de prueba (Comprobante)
  const compraPrueba = await prisma.compraComprobante.create({
    data: {
      tipo: TipoComprobante.FACTURA_MERCADERIA,
      proveedorId: proveedor1.id,
      nroComprobante: '0002-00004567',
      detalle: 'Compra de mercadería para stock',
      neto: 5000.00,
      noGravado: 0,
      montoTotal: 6050.00,
      saldo: 0,
      estado: EstadoComprobante.PAGADO,
      impuestos: {
        create: [
          {
            impuestoId: impIva.id,
            monto: 1050.00,
          },
        ],
      },
    },
  });

  // 9. Gasto Vario de prueba
  await prisma.gastoVario.create({
    data: {
      nombreCorto: 'Internet Local',
      tipo: 'Servicios',
      nroComprobante: '0004-00098765',
      neto: 10000.00,
      noGravado: 0,
      importe: 12100.00,
      formaPagoId: fpEfectivo.id,
      impuestos: {
        create: [
          {
            impuestoId: impIva.id,
            monto: 2100.00,
          },
        ],
      },
    },
  });

  console.log('✅ Seed completado con éxito. ¡Datos de prueba insertados!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error ejecutando el seed:', e);
    await prisma.$disconnect();
  });