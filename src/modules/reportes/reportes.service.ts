import { prisma } from '../../common/prisma-client';

export const reportesService = {
  async reporteImpositivo(impuestoId: number, desde: Date, hasta: Date) {
    const impuesto = await prisma.impuesto.findUniqueOrThrow({ where: { id: impuestoId } });
    const alicuota = Number(impuesto.alicuota);

    const [ventas, comprobantes] = await Promise.all([
      prisma.venta.findMany({
        where: { fecha: { gte: desde, lte: hasta } },
        include: { detalle: true, cliente: true },
      }),
      prisma.compraComprobante.findMany({
        where: { fecha: { gte: desde, lte: hasta }, tipo: 'FACTURA_MERCADERIA' },
        include: { proveedor: true },
      }),
    ]);

    const movimientos = [
      // Del lado de ventas no se guarda el IVA discriminado (el precio ya
      // lo incluye), así que se estima aplicando la alícuota del impuesto
      // sobre el total — es una aproximación, no un dato duro como en compras.
      ...ventas.map((v) => {
        const total = v.detalle.reduce((acc, d) => acc + Number(d.subtotal), 0);
        const neto = Math.round((total / (1 + alicuota)) * 100) / 100;
        return {
          fecha: v.fecha, origen: 'VENTA' as const, concepto: `Venta #${v.id}`,
          contraparte: v.cliente.nombre, neto, montoImpuesto: Math.round((total - neto) * 100) / 100,
        };
      }),
      // En compras sí hay un monto real cargado en el comprobante.
      ...comprobantes.map((c) => ({
        fecha: c.fecha, origen: 'COMPRA' as const, concepto: c.nroComprobante ?? `Comprobante #${c.id}`,
        contraparte: c.proveedor.nombre, neto: Number(c.neto),
        montoImpuesto: Number(impuesto.nombre === 'IVA' ? c.iva : impuesto.nombre === 'IIBB' ? c.iibb : 0),
      })),
    ].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    return {
      impuesto: impuesto.nombre,
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      movimientos,
      totalNeto: Math.round(movimientos.reduce((acc, m) => acc + m.neto, 0) * 100) / 100,
      totalImpuesto: Math.round(movimientos.reduce((acc, m) => acc + m.montoImpuesto, 0) * 100) / 100,
    };
  },

  async resultadoPeriodo(desde: Date, hasta: Date) {
    const [ventas, comprobantes, gastos] = await Promise.all([
      prisma.venta.findMany({ where: { fecha: { gte: desde, lte: hasta } }, include: { detalle: true } }),
      prisma.compraComprobante.findMany({ where: { fecha: { gte: desde, lte: hasta } }, include: { proveedor: true } }),
      prisma.gastoVario.findMany({ where: { fecha: { gte: desde, lte: hasta } }, include: { formaPago: true } }),
    ]);

    const ingresosVentas = ventas.reduce(
      (acc, v) => acc + v.detalle.reduce((a, d) => a + Number(d.subtotal), 0), 0,
    );
    const cmv = ventas.reduce(
      (acc, v) => acc + v.detalle.reduce((a, d) => a + Number(d.costoUnitario) * Number(d.cantidad), 0), 0,
    );

    // Facturas y ND suman al costo de compras; las NC lo restan (sean o
    // no independientes: en cualquier caso representan menos costo real).
    const signoPorTipo: Record<string, number> = { FACTURA_MERCADERIA: 1, NOTA_DEBITO: 1, NOTA_CREDITO: -1 };
    const comprasDetalle = comprobantes.map((c) => ({
      fecha: c.fecha, proveedor: c.proveedor.nombre, nroComprobante: c.nroComprobante,
      tipo: c.tipo, monto: Number(c.montoTotal) * signoPorTipo[c.tipo],
    }));
    const totalCompras = comprasDetalle.reduce((acc, c) => acc + c.monto, 0);

    const gastosDetalle = gastos.map((g) => ({
      fecha: g.fecha, nombreCorto: g.nombreCorto, tipo: g.tipo, importe: Number(g.importe), formaPago: g.formaPago.nombre,
    }));
    const totalGastos = gastosDetalle.reduce((acc, g) => acc + g.importe, 0);

    const resultadoBruto = ingresosVentas - totalCompras - totalGastos;
    const resultadoNeto = resultadoBruto - cmv;

    return {
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      ventas: { total: round2(ingresosVentas) },
      compras: { total: round2(totalCompras), detalle: comprasDetalle.map(redondearMonto) },
      gastos: { total: round2(totalGastos), detalle: gastosDetalle },
      cmv: round2(cmv),
      resultadoBruto: round2(resultadoBruto),
      resultadoNeto: round2(resultadoNeto),
    };
  },
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function redondearMonto<T extends { monto: number }>(item: T): T {
  return { ...item, monto: round2(item.monto) };
}
