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
        include: { 
          proveedor: true, 
          impuestos: {
            include: {
              impuesto: true,
            },
          }, 
        },
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
      ...comprobantes.map((c) => {
        // Buscamos si este comprobante tiene aplicado el impuesto del reporte (por ID o por coincidencia de nombre)
        const impuestoAplicado = c.impuestos?.find(
          (i: any) => i.impuestoId === impuesto.id || i.impuesto?.impuesto?.nombre?.toLowerCase() === impuesto.nombre?.toLowerCase()
        );

        return {
          fecha: c.fecha, 
          origen: 'COMPRA' as const, 
          concepto: c.nroComprobante ?? `Comprobante #${c.id}`,
          contraparte: c.proveedor.nombre, 
          neto: Number(c.neto),
          montoImpuesto: Number(impuestoAplicado?.monto ?? 0),
        };
      }),
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
      prisma.compraComprobante.findMany({ where: { fecha: { gte: desde, lte: hasta } }, include: { proveedor: true, impuestos: {
      include: {
        impuesto: true,
      },
    }, } }),
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

  async resumenFormaPago(formaPagoId: number, desde: Date, hasta: Date) {
    const formaPago = await prisma.formaPago.findUniqueOrThrow({ where: { id: formaPagoId } });

    const [ventas, cobros, pagos, gastos] = await Promise.all([
      prisma.venta.findMany({
        where: { formaPagoId, fecha: { gte: desde, lte: hasta } },
        include: { detalle: true, cliente: true, impuestos: true },
      }),
      prisma.cobroCC.findMany({
        where: { formaPagoId, fecha: { gte: desde, lte: hasta }, haber: { gt: 0 } },
        include: { cliente: true },
      }),
      prisma.compraPago.findMany({
        where: { formaPagoId, fecha: { gte: desde, lte: hasta } },
        include: { proveedor: true },
      }),
      prisma.gastoVario.findMany({
        where: { formaPagoId, fecha: { gte: desde, lte: hasta } },
      }),
    ]);

    const movimientos: { fecha: Date; concepto: string; tipo: string; monto: number }[] = [];

    for (const v of ventas) {
      if (v.formaPagoId && v.formaPagoId === formaPagoId) {
        if (formaPago.nombre.toLowerCase() === 'cuenta corriente') continue;
        const totalItems = v.detalle.reduce((acc: number, d) => acc + Number(d.subtotal), 0);
        const totalImpuestos = (v.impuestos ?? []).reduce((acc: number, i: { monto: unknown }) => acc + Number(i.monto), 0);
        const totalVenta = Math.round((Number(v.neto) + Number(v.noGravado) + totalImpuestos) * 100) / 100 || totalItems;
        movimientos.push({
          fecha: v.fecha,
          concepto: `Venta a ${v.cliente.nombre}`,
          tipo: 'Venta',
          monto: totalVenta, // positivo
        });
      }
    }

    for (const c of cobros) {
      movimientos.push({
        fecha: c.fecha,
        concepto: `Cobro cta. cte. — ${c.cliente.nombre}`,
        tipo: 'Cobro Cuenta Corriente',
        monto: Number(c.haber), // positivo
      });
    }

    for (const p of pagos) {
      movimientos.push({
        fecha: p.fecha,
        concepto: `Pago a ${p.proveedor.nombre}`,
        tipo: 'Pago Compra',
        monto: -Number(p.importe), // negativo
      });
    }

    for (const g of gastos) {
      movimientos.push({
        fecha: g.fecha,
        concepto: g.nombreCorto,
        tipo: 'Gasto Vario',
        monto: -Number(g.importe), // negativo
      });
    }

    movimientos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    const totalGeneral = Math.round(movimientos.reduce((acc, m) => acc + m.monto, 0) * 100) / 100;

    return {
      formaPago: formaPago.nombre,
      activa: formaPago.activa,
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      movimientos: movimientos.map(m => ({ ...m, monto: round2(m.monto) })),
      totalGeneral,
    };
  },
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function redondearMonto<T extends { monto: number }>(item: T): T {
  return { ...item, monto: round2(item.monto) };
}