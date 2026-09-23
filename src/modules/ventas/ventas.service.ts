import { prisma } from '../../common/prisma-client';
import { obtenerOCrearFormaPago } from '../../common/catalogos';

interface ItemVentaInput { productoId: number; cantidad: number; precioUnitario: number; }
interface ImpuestoAplicadoInput { impuestoId: number; monto: number; }
interface VentaInput {
  clienteId: number;
  formaPago: string;
  nroComprobante?: string;
  neto?: number;
  noGravado?: number;
  impuestos?: ImpuestoAplicadoInput[];
  items: ItemVentaInput[];
}
interface CobroCCInput { clienteId: number; monto: number; formaPago: string; observaciones?: string; }

export const ventasService = {
  async registrar(datos: VentaInput) {
    const formaPagoId = await obtenerOCrearFormaPago(datos.formaPago);
    const productos = await prisma.producto.findMany({
      where: { id: { in: datos.items.map((i) => i.productoId) } },
    });
    const costoPorProducto = new Map(productos.map((p) => [p.id, Number(p.costo)]));

    const venta = await prisma.$transaction(async (tx) => {
      const nuevaVenta = await tx.venta.create({
        data: {
          clienteId: datos.clienteId,
          formaPagoId,
          nroComprobante: datos.nroComprobante,
          neto: datos.neto ?? 0,
          noGravado: datos.noGravado ?? 0,
          detalle: {
            create: datos.items.map((it) => ({
              productoId: it.productoId,
              cantidad: it.cantidad,
              precioUnitario: it.precioUnitario,
              costoUnitario: costoPorProducto.get(it.productoId) ?? 0,
              subtotal: Math.round(it.precioUnitario * it.cantidad * 100) / 100,
            })),
          },
          impuestos: datos.impuestos?.length
            ? {
                create: datos.impuestos.map((imp) => ({
                  impuestoId: imp.impuestoId,
                  monto: imp.monto,
                })),
              }
            : undefined,
        },
        include: { detalle: true, formaPago: true, impuestos: true },
      });

      for (const it of datos.items) {
        await tx.producto.update({ where: { id: it.productoId }, data: { stock: { decrement: it.cantidad } } });
      }

      const totalItems = nuevaVenta.detalle.reduce((acc, d) => acc + Number(d.subtotal), 0);
      const totalImpuestos = nuevaVenta.impuestos.reduce((acc, i) => acc + Number(i.monto), 0);
      const totalVenta = Math.round((Number(nuevaVenta.neto) + Number(nuevaVenta.noGravado) + totalImpuestos) * 100) / 100 || totalItems;

      if (nuevaVenta.formaPago.nombre.toLowerCase() === 'cuenta corriente') {
        await tx.cobroCC.create({
          data: {
            clienteId: datos.clienteId,
            concepto: `Venta #${nuevaVenta.id}`,
            debe: totalVenta,
            haber: 0,
          },
        });
      }

      return { ...nuevaVenta, total: totalVenta };
    }, {
      maxWait: 5000,
      timeout: 15000
    });

    return { id: venta.id, fecha: venta.fecha, clienteId: venta.clienteId, formaPago: datos.formaPago, total: venta.total };
  },

  async cuentaCorriente(clienteId: number) {
    const movimientos = await prisma.cobroCC.findMany({
      where: { clienteId },
      orderBy: { fecha: 'asc' },
    });
    let saldo = 0;
    return movimientos.map((m) => {
      saldo += Number(m.debe) - Number(m.haber);
      return {
        fecha: m.fecha, concepto: m.concepto, debe: Number(m.debe), haber: Number(m.haber),
        saldoAcumulado: Math.round(saldo * 100) / 100,
      };
    });
  },

  async registrarCobro(datos: CobroCCInput) {
    const formaPagoId = await obtenerOCrearFormaPago(datos.formaPago);
    await prisma.cobroCC.create({
      data: {
        clienteId: datos.clienteId,
        concepto: 'Cobro',
        debe: 0,
        haber: datos.monto,
        formaPagoId,
        observaciones: datos.observaciones,
      },
    });
    return this.cuentaCorriente(datos.clienteId);
  },
};