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
      ...ventas.map((v: any) => {
        const total = v.detalle.reduce((acc: number, d: any) => acc + Number(d.subtotal), 0);
        const neto = Math.round((total / (1 + alicuota)) * 100) / 100;
        return {
          fecha: v.fecha, 
          origen: 'VENTA' as const, 
          concepto: `Venta #${v.id}`,
          contraparte: v.cliente?.nombre || 'Consumidor Final', 
          cuit: v.cliente?.dniCuit || '',
          comprobante: v.nroComprobante || `Venta #${v.id}`,
          neto, 
          montoImpuesto: Math.round((total - neto) * 100) / 100,
        };
      }),
      ...comprobantes.map((c: any) => {
        const impuestoAplicado = c.impuestos?.find(
          (i: any) => i.impuestoId === impuesto.id || i.impuesto?.impuesto?.nombre?.toLowerCase() === impuesto.nombre?.toLowerCase()
        );

        return {
          fecha: c.fecha, 
          origen: 'COMPRA' as const, 
          concepto: c.nroComprobante ?? `Comprobante #${c.id}`,
          contraparte: c.proveedor?.nombre || 'Proveedor', 
          cuit: c.proveedor?.cuit || '',
          comprobante: c.nroComprobante || '',
          neto: Number(c.neto || 0),
          montoImpuesto: Number(impuestoAplicado?.monto ?? 0),
        };
      }),
      ...gastos.map((g: any) => {
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
          neto: Number(g.neto || 0),
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
      (acc, v: any) => acc + v.detalle.reduce((a: number, d: any) => a + Number(d.subtotal), 0), 0,
    );
    const cmv = ventas.reduce(
      (acc, v: any) => acc + v.detalle.reduce((a: number, d: any) => a + Number(d.costoUnitario) * Number(d.cantidad), 0), 0,
    );

    let totalImpuestosPeriodo = 0;
    for (const v of ventas as any[]) {
      if (v.impuestos && Array.isArray(v.impuestos)) {
        totalImpuestosPeriodo += v.impuestos.reduce((acc: number, i: any) => acc + Number(i.monto || 0), 0);
      }
    }
    for (const c of comprobantes as any[]) {
      if (c.impuestos && Array.isArray(c.impuestos)) {
        totalImpuestosPeriodo += c.impuestos.reduce((acc: number, i: any) => acc + Number(i.monto || 0), 0);
      }
    }
    for (const g of gastos as any[]) {
      if (g.impuestos && Array.isArray(g.impuestos)) {
        totalImpuestosPeriodo += g.impuestos.reduce((acc: number, i: any) => acc + Number(i.monto || 0), 0);
      }
    }

    const signoPorTipo: Record<string, number> = { FACTURA_MERCADERIA: 1, NOTA_DEBITO: 1, NOTA_CREDITO: -1 };
    const comprasDetalle = comprobantes.map((c: any) => ({
      fecha: c.fecha, proveedor: c.proveedor?.nombre || 'Proveedor', nroComprobante: c.nroComprobante,
      tipo: c.tipo, monto: Number(c.montoTotal || 0) * (signoPorTipo[c.tipo] ?? 1),
    }));
    const totalCompras = comprasDetalle.reduce((acc, c) => acc + c.monto, 0);

    const gastosDetalle = gastos.map((g: any) => ({
      fecha: g.fecha, nombreCorto: g.nombreCorto, tipo: g.tipo, importe: Number(g.importe || 0), formaPago: g.formaPago?.nombre || '—',
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

    for (const v of ventas as any[]) {
      if (v.formaPagoId && v.formaPagoId === formaPagoId) {
        if (formaPago.nombre.toLowerCase() === 'cuenta corriente') continue;
        const totalItems = (v.detalle ?? []).reduce((acc: number, d: any) => acc + Number(d.subtotal), 0);
        const totalImpuestos = (v.impuestos ?? []).reduce((acc: number, i: any) => acc + Number(i.monto), 0);
        const totalVenta = Math.round((Number(v.neto || 0) + Number(v.noGravado || 0) + totalImpuestos) * 100) / 100 || totalItems;
        movimientos.push({
          fecha: v.fecha,
          concepto: `Venta a ${v.cliente?.nombre || 'Cliente'}`,
          tipo: 'Venta',
          monto: totalVenta,
        });
      }
    }

    for (const c of cobros as any[]) {
      movimientos.push({
        fecha: c.fecha,
        concepto: `Cobro cta. cte. — ${c.cliente?.nombre || 'Cliente'}`,
        tipo: 'Cobro Cuenta Corriente',
        monto: Number(c.haber || 0),
      });
    }

    for (const p of pagos as any[]) {
      movimientos.push({
        fecha: p.fecha,
        concepto: `Pago a ${p.proveedor?.nombre || 'Proveedor'}`,
        tipo: 'Pago Compra',
        monto: -Number(p.importe || 0),
      });
    }

    for (const g of gastos as any[]) {
      movimientos.push({
        fecha: g.fecha,
        concepto: g.nombreCorto,
        tipo: 'Gasto Vario',
        monto: -Number(g.importe || 0),
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

  async movimientos(desde: Date, hasta: Date, modulo?: string) {
    const [ventas, compras, gastos] = await Promise.all([
      prisma.venta.findMany({
        where: { fecha: { gte: desde, lte: hasta } },
        include: { 
          cliente: true, 
          formaPago: true, 
          impuestos: { include: { impuesto: true } }, 
          detalle: true 
        },
      }),
      prisma.compraComprobante.findMany({
        where: { fecha: { gte: desde, lte: hasta } },
        include: { 
          proveedor: true, 
          pagos: { include: { pago: { include: { formaPago: true } } } }, 
          impuestos: { include: { impuesto: true } } 
        },
      }),
      prisma.gastoVario.findMany({
        where: { fecha: { gte: desde, lte: hasta } },
        include: { 
          formaPago: true, 
          impuestos: { include: { impuesto: true } } 
        },
      }),
    ]);

    const desglosarImpuestos = (
      impuestosList: any[],
      netoVal: number,
      totalVal: number,
      signo: number = 1
    ) => {
      let iva = 0;
      let iibb = 0;
      let totalImp = 0;

      if (impuestosList && impuestosList.length > 0) {
        for (const item of impuestosList) {
          const monto = Number(item.monto || 0);
          const nombre = (item.impuesto?.nombre || '').toLowerCase();
          totalImp += monto;

          if (nombre.includes('iva')) {
            iva += monto;
          } else if (nombre.includes('iibb') || nombre.includes('ingresos brutos') || nombre.includes('perc')) {
            iibb += monto;
          } else {
            iva += monto;
          }
        }
      }

      const diff = Math.abs(totalVal) - Math.abs(netoVal);
      if (totalImp === 0 && diff > 0.01) {
        iva = diff;
        totalImp = diff;
      }

      return {
        iva: round2(iva * signo),
        iibb: round2(iibb * signo),
        impuestosMonto: round2(totalImp * signo),
      };
    };

    const listaVentas = ventas.map((v: any) => {
      const neto = Number(v.neto || 0);
      const rawImpuestosTotal = (v.impuestos ?? []).reduce((acc: number, i: any) => acc + Number(i.monto || 0), 0);
      const totalItems = (v.detalle ?? []).reduce((acc: number, d: any) => acc + Number(d.subtotal || 0), 0);
      const totalVenta = Math.round((neto + Number(v.noGravado || 0) + rawImpuestosTotal) * 100) / 100 || totalItems;

      const imp = desglosarImpuestos(v.impuestos, neto || (totalVenta - rawImpuestosTotal), totalVenta, 1);
      const netoCalculado = neto || Math.round((totalVenta - imp.impuestosMonto) * 100) / 100;

      return {
        fecha: v.fecha,
        modulo: 'VENTAS' as const,
        concepto: `Venta #${v.id}`,
        contraparte: v.cliente?.nombre || 'Consumidor Final',
        comprobante: v.nroComprobante || 'Sin Factura',
        formaPago: v.formaPago?.nombre || '—',
        neto: round2(netoCalculado),
        iva: imp.iva,
        iibb: imp.iibb,
        impuestosMonto: imp.impuestosMonto,
        monto: round2(totalVenta),
      };
    });

    const listaCompras = compras.map((c: any) => {
      const signo = c.tipo === 'NOTA_CREDITO' ? 1 : -1;
      const neto = Number(c.neto || 0);
      const montoTotal = Number(c.montoTotal || 0);

      const imp = desglosarImpuestos(c.impuestos, neto, montoTotal, signo);

      const formaPagoTexto = (c.pagos ?? [])
        .map((p: any) => p.pago?.formaPago?.nombre)
        .filter(Boolean)
        .join(', ') || '—';

      return {
        fecha: c.fecha,
        modulo: 'COMPRAS' as const,
        concepto: `Compra ${c.tipo}`,
        contraparte: c.proveedor?.nombre || 'Proveedor',
        comprobante: c.nroComprobante || '—',
        formaPago: formaPagoTexto,
        neto: round2(neto * signo),
        iva: imp.iva,
        iibb: imp.iibb,
        impuestosMonto: imp.impuestosMonto,
        monto: round2(montoTotal * signo),
      };
    });

    const listaGastos = gastos.map((g: any) => {
      const neto = Number(g.neto || 0);
      const importe = Number(g.importe || 0);
      const imp = desglosarImpuestos(g.impuestos, neto, importe, -1);

      return {
        fecha: g.fecha,
        modulo: 'GASTOS' as const,
        concepto: `${g.nombreCorto} (${g.tipo})`,
        contraparte: g.formaPago?.nombre || 'Gasto Vario',
        comprobante: g.nroComprobante || `Gasto #${g.id}`,
        formaPago: g.formaPago?.nombre || '—',
        neto: round2(-neto),
        iva: imp.iva,
        iibb: imp.iibb,
        impuestosMonto: imp.impuestosMonto,
        monto: round2(-importe),
      };
    });

    let todos = [...listaVentas, ...listaCompras, ...listaGastos];

    if (modulo && modulo !== 'TODOS') {
      todos = todos.filter((m) => m.modulo === modulo);
    }

    return todos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  },

  // Nuevo método para la pestaña Clientes / Proveedores de Reportes
  async reporteClientesProveedores(desde: Date, hasta: Date) {
    const [clientes, proveedores] = await Promise.all([
      prisma.cliente.findMany({
        include: {
          categoria: true,
          ventas: {
            where: { fecha: { gte: desde, lte: hasta } },
            include: { detalle: true, impuestos: true },
          },
        },
        orderBy: { nombre: 'asc' },
      }),
      prisma.proveedor.findMany({
        include: {
          comprobantes: {
            where: { fecha: { gte: desde, lte: hasta } },
          },
        },
        orderBy: { nombre: 'asc' },
      }),
    ]);

    const resumenClientes = clientes.map((c: any) => {
      let totalVendido = 0;
      for (const v of c.ventas) {
        const rawImpuestosTotal = (v.impuestos ?? []).reduce((acc: number, i: any) => acc + Number(i.monto || 0), 0);
        const totalItems = (v.detalle ?? []).reduce((acc: number, d: any) => acc + Number(d.subtotal || 0), 0);
        const totalVenta = Math.round((Number(v.neto || 0) + Number(v.noGravado || 0) + rawImpuestosTotal) * 100) / 100 || totalItems;
        totalVendido += totalVenta;
      }

      return {
        id: c.id,
        nombre: c.nombre,
        cuit: c.dniCuit || '—',
        categoria: c.categoria?.nombre || '—',
        cuentaCorriente: c.cuentaCorriente,
        activo: c.activo,
        cantidadOperaciones: c.ventas.length,
        totalMonto: round2(totalVendido),
      };
    });

    const signoPorTipo: Record<string, number> = { FACTURA_MERCADERIA: 1, NOTA_DEBITO: 1, NOTA_CREDITO: -1 };

    const resumenProveedores = proveedores.map((p: any) => {
      let totalComprado = 0;
      for (const comp of p.comprobantes) {
        const signo = signoPorTipo[comp.tipo] ?? 1;
        totalComprado += Number(comp.montoTotal || 0) * signo;
      }

      return {
        id: p.id,
        nombre: p.nombre,
        cuit: p.cuit || '—',
        categoria: p.categoria || '—',
        activo: p.activo,
        cantidadOperaciones: p.comprobantes.length,
        totalMonto: round2(totalComprado),
      };
    });

    return {
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      clientes: resumenClientes,
      proveedores: resumenProveedores,
      totales: {
        totalVentasClientes: round2(resumenClientes.reduce((acc, c) => acc + c.totalMonto, 0)),
        totalComprasProveedores: round2(resumenProveedores.reduce((acc, p) => acc + p.totalMonto, 0)),
      },
    };
  },
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function redondearMonto<T extends { monto: number }>(item: T): T {
  return { ...item, monto: round2(item.monto) };
}