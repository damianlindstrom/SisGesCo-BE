import { prisma } from '../../common/prisma-client';

export const reportesService = {
  async reporteImpositivo(impuestoId: number, desde: Date, hasta: Date) {
    const impuesto = await prisma.impuesto.findUniqueOrThrow({ where: { id: impuestoId } });
    const alicuota = Number(impuesto.alicuota);

    const [ventas, comprobantes, gastos] = await Promise.all([
      prisma.venta.findMany({
        where: { fecha: { gte: desde, lte: hasta } },
        include: { detalle: true, cliente: true, impuestos: true },
      }),
      prisma.compraComprobante.findMany({
        where: { fecha: { gte: desde, lte: hasta } },
        include: { 
          proveedor: true, 
          impuestos: {
            include: {
              impuesto: true,
            },
          }, 
        },
      }),
      prisma.gastoVario.findMany({
        where: { fecha: { gte: desde, lte: hasta } },
        include: { 
          formaPago: true,
          impuestos: {
            include: {
              impuesto: true,
            },
          },
        },
      }),
    ]);

    const movimientos = [
      // Ventas: se estima el IVA aplicando la alícuota sobre el total
      ...ventas.map((v) => {
        const total = v.detalle.reduce((acc, d) => acc + Number(d.subtotal), 0);
        const neto = Math.round((total / (1 + alicuota)) * 100) / 100;
        return {
          fecha: v.fecha, 
          origen: 'VENTA' as const, 
          concepto: `Venta #${v.id}`,
          contraparte: v.cliente.nombre, 
          cuit: v.cliente.dniCuit || '',
          comprobante: v.nroComprobante || `Venta #${v.id}`,
          neto, 
          montoImpuesto: Math.round((total - neto) * 100) / 100,
        };
      }),
      // Compras: monto real cargado en el comprobante
      ...comprobantes.map((c) => {
        const impuestoAplicado = c.impuestos?.find(
          (i: any) => i.impuestoId === impuesto.id || i.impuesto?.impuesto?.nombre?.toLowerCase() === impuesto.nombre?.toLowerCase()
        );

        return {
          fecha: c.fecha, 
          origen: 'COMPRA' as const, 
          concepto: c.nroComprobante ?? `Comprobante #${c.id}`,
          contraparte: c.proveedor.nombre, 
          cuit: c.proveedor.cuit || '',
          comprobante: c.nroComprobante || '',
          neto: Number(c.neto),
          montoImpuesto: Number(impuestoAplicado?.monto ?? 0),
        };
      }),
      // Gastos Varios: usando el neto y el impuesto real asociado
      ...gastos.map((g) => {
        const impuestoAplicado = g.impuestos?.find(
          (i: any) => i.impuestoId === impuesto.id || i.impuesto?.impuesto?.nombre?.toLowerCase() === impuesto.nombre?.toLowerCase()
        );

        return {
          fecha: g.fecha,
          origen: 'GASTO' as const,
          concepto: g.nombreCorto,
          contraparte: g.formaPago?.nombre || 'Gasto Vario',
          cuit: '',
          comprobante: g.nroComprobante || `Gasto #${g.id}`,
          neto: Number(g.neto),
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
      prisma.venta.findMany({ 
        where: { fecha: { gte: desde, lte: hasta } }, 
        include: { detalle: true, impuestos: true } 
      }),
      prisma.compraComprobante.findMany({ 
        where: { fecha: { gte: desde, lte: hasta } }, 
        include: { 
          proveedor: true, 
          impuestos: { include: { impuesto: true } } 
        } 
      }),
      prisma.gastoVario.findMany({ 
        where: { fecha: { gte: desde, lte: hasta } }, 
        include: { formaPago: true, impuestos: true } 
      }),
    ]);

    const ingresosVentas = ventas.reduce(
      (acc, v) => acc + v.detalle.reduce((a, d) => a + Number(d.subtotal), 0), 0,
    );
    const cmv = ventas.reduce(
      (acc, v) => acc + v.detalle.reduce((a, d) => a + Number(d.costoUnitario) * Number(d.cantidad), 0), 0,
    );

    // Cálculo del total de impuestos acumulados en el período (incluyendo ventas, compras y gastos)
    let totalImpuestosPeriodo = 0;
    for (const v of ventas) {
      if (v.impuestos && Array.isArray(v.impuestos)) {
        totalImpuestosPeriodo += v.impuestos.reduce((acc, i) => acc + Number(i.monto || 0), 0);
      }
    }
    for (const c of comprobantes) {
      if (c.impuestos && Array.isArray(c.impuestos)) {
        totalImpuestosPeriodo += c.impuestos.reduce((acc, i) => acc + Number(i.monto || 0), 0);
      }
    }
    for (const g of gastos) {
      if (g.impuestos && Array.isArray(g.impuestos)) {
        totalImpuestosPeriodo += g.impuestos.reduce((acc, i) => acc + Number(i.monto || 0), 0);
      }
    }

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
      totalImpuestosPeriodo: round2(totalImpuestosPeriodo),
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
          monto: totalVenta,
        });
      }
    }

    for (const c of cobros) {
      movimientos.push({
        fecha: c.fecha,
        concepto: `Cobro cta. cte. — ${c.cliente.nombre}`,
        tipo: 'Cobro Cuenta Corriente',
        monto: Number(c.haber),
      });
    }

    for (const p of pagos) {
      movimientos.push({
        fecha: p.fecha,
        concepto: `Pago a ${p.proveedor.nombre}`,
        tipo: 'Pago Compra',
        monto: -Number(p.importe),
      });
    }

    for (const g of gastos) {
      movimientos.push({
        fecha: g.fecha,
        concepto: g.nombreCorto,
        tipo: 'Gasto Vario',
        monto: -Number(g.importe),
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