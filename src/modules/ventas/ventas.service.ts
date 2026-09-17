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

  async arqueo(desde: Date, hasta: Date) {
    const [ventas, cobros, pagos, gastos] = await Promise.all([
      prisma.venta.findMany({
        where: { fecha: { gte: desde, lte: hasta } },
        include: { detalle: true, formaPago: true, cliente: true, impuestos: true },
      }),
      prisma.cobroCC.findMany({
        where: { fecha: { gte: desde, lte: hasta }, haber: { gt: 0 } },
        include: { formaPago: true, cliente: true },
      }),
      prisma.compraPago.findMany({
        where: { fecha: { gte: desde, lte: hasta } },
        include: { formaPago: true, proveedor: true },
      }),
      prisma.gastoVario.findMany({
        where: { fecha: { gte: desde, lte: hasta } },
        include: { formaPago: true },
      }),
    ]);

    const movimientos: { fecha: Date; concepto: string; formaPago: string; ingreso: number; egreso: number }[] = [];

for (const v of ventas) {
  if (v.formaPago.nombre.toLowerCase() === 'cuenta corriente') continue;
  const totalItems = v.detalle.reduce((acc: number, d) => acc + Number(d.subtotal), 0);
  const totalImpuestos = (v.impuestos ?? []).reduce((acc: number, i: { monto: unknown }) => acc + Number(i.monto), 0);
  const totalVenta = Math.round((Number(v.neto) + Number(v.noGravado) + totalImpuestos) * 100) / 100 || totalItems;
  movimientos.push({ fecha: v.fecha, concepto: `Venta a ${v.cliente.nombre}`, formaPago: v.formaPago.nombre, ingreso: totalVenta, egreso: 0 });
}
    for (const c of cobros) {
      movimientos.push({
        fecha: c.fecha, concepto: `Cobro cta. cte. — ${c.cliente.nombre}`,
        formaPago: c.formaPago?.nombre ?? '—', ingreso: Number(c.haber), egreso: 0,
      });
    }
    for (const p of pagos) {
      movimientos.push({ fecha: p.fecha, concepto: `Pago a ${p.proveedor.nombre}`, formaPago: p.formaPago.nombre, ingreso: 0, egreso: Number(p.importe) });
    }
    for (const g of gastos) {
      movimientos.push({ fecha: g.fecha, concepto: g.nombreCorto, formaPago: g.formaPago.nombre, ingreso: 0, egreso: Number(g.importe) });
    }

    movimientos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    const totalIngresos = movimientos.reduce((acc, m) => acc + m.ingreso, 0);
    const totalEgresos = movimientos.reduce((acc, m) => acc + m.egreso, 0);

    const porFormaPagoMap = new Map<string, number>();
    for (const m of movimientos) {
      const neto = m.ingreso - m.egreso;
      porFormaPagoMap.set(m.formaPago, (porFormaPagoMap.get(m.formaPago) ?? 0) + neto);
    }

    return {
      totalIngresos: Math.round(totalIngresos * 100) / 100,
      totalEgresos: Math.round(totalEgresos * 100) / 100,
      saldoNeto: Math.round((totalIngresos - totalEgresos) * 100) / 100,
      porFormaPago: Array.from(porFormaPagoMap.entries()).map(([formaPago, total]) => ({ formaPago, total: Math.round(total * 100) / 100 })),
      movimientos,
    };
  },
};