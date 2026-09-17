import { EstadoComprobante, TipoComprobante } from '@prisma/client';
import { prisma } from '../../common/prisma-client';
import { obtenerOCrearFormaPago } from '../../common/catalogos';

interface ItemComprobanteInput { productoNombre: string; cantidad: number; costoUnitario: number; }
interface ImpuestoAplicadoInput { impuestoId: number; monto: number; }
interface ComprobanteInput {
  proveedorId: number;
  tipo: TipoComprobante;
  nroComprobante: string;
  detalle?: string;
  neto?: number;
  noGravado?: number;
  impuestos?: ImpuestoAplicadoInput[];
  items?: ItemComprobanteInput[];
  comprobanteVinculadoId?: number;
}
interface PagoInput { proveedorId: number; comprobanteIds: number[]; importe: number; formaPago: string; }

function estadoSegunSaldo(saldo: number, total: number): EstadoComprobante {
  if (saldo <= 0) return 'PAGADO';
  if (saldo < total) return 'PAGO_PARCIAL';
  return 'PENDIENTE';
}

export const comprasService = {
  async registrarComprobante(datos: ComprobanteInput) {
    const neto = datos.neto ?? 0;
    const noGravado = datos.noGravado ?? 0;
    const totalImpuestos = datos.impuestos?.reduce((acc: number, i) => acc + i.monto, 0) ?? 0;
    const montoTotal = Math.round((neto + noGravado + totalImpuestos) * 100) / 100;

    return prisma.$transaction(async (tx) => {
      if (datos.tipo === 'NOTA_CREDITO' && datos.comprobanteVinculadoId) {
        const original = await tx.compraComprobante.findUniqueOrThrow({ where: { id: datos.comprobanteVinculadoId } });
        const nuevoSaldoOriginal = Math.max(0, Number(original.saldo) - montoTotal);
        await tx.compraComprobante.update({
          where: { id: original.id },
          data: { saldo: nuevoSaldoOriginal, estado: estadoSegunSaldo(nuevoSaldoOriginal, Number(original.montoTotal)) },
        });
        return tx.compraComprobante.create({
          data: {
            proveedorId: datos.proveedorId, tipo: datos.tipo, nroComprobante: datos.nroComprobante,
            detalle: datos.detalle, neto, noGravado,
            montoTotal, saldo: 0, estado: 'PAGADO', comprobanteVinculadoId: original.id,
            impuestos: datos.impuestos?.length
              ? { create: datos.impuestos.map((imp) => ({ impuestoId: imp.impuestoId, monto: imp.monto })) }
              : undefined,
          },
        });
      }

      const estadoInicial: EstadoComprobante = datos.tipo === 'NOTA_CREDITO' ? 'CREDITO_DISPONIBLE' : 'PENDIENTE';

      const comprobante = await tx.compraComprobante.create({
        data: {
          proveedorId: datos.proveedorId, tipo: datos.tipo, nroComprobante: datos.nroComprobante,
          detalle: datos.detalle, neto, noGravado,
          montoTotal, saldo: montoTotal, estado: estadoInicial,
          impuestos: datos.impuestos?.length
            ? { create: datos.impuestos.map((imp) => ({ impuestoId: imp.impuestoId, monto: imp.monto })) }
            : undefined,
        },
      });

      if (datos.tipo === 'FACTURA_MERCADERIA' && datos.items?.length) {
        for (const item of datos.items) {
          let producto = await tx.producto.findFirst({ where: { nombre: item.productoNombre } });
          if (!producto) {
            producto = await tx.producto.create({
              data: {
                nombre: item.productoNombre, costo: item.costoUnitario, stock: 0,
                pctRespInsc: 1, pctConsFinal: 1, pctCtaCte: 1,
              },
            });
          }
          await tx.compraComprobanteItem.create({
            data: { comprobanteId: comprobante.id, productoId: producto.id, cantidad: item.cantidad, costoUnitario: item.costoUnitario },
          });
          await tx.producto.update({
            where: { id: producto.id },
            data: { stock: { increment: item.cantidad }, costo: item.costoUnitario },
          });
        }
      }

      return comprobante;
    });
  },

  comprobantesPendientes(proveedorId: number) {
    return prisma.compraComprobante.findMany({
      where: { proveedorId, estado: { in: ['PENDIENTE', 'PAGO_PARCIAL', 'CREDITO_DISPONIBLE'] } },
      orderBy: { fecha: 'asc' },
    });
  },

  async registrarPago(datos: PagoInput) {
    const formaPagoId = await obtenerOCrearFormaPago(datos.formaPago);

    return prisma.$transaction(async (tx) => {
      const pago = await tx.compraPago.create({
        data: {
          proveedorId: datos.proveedorId, importe: datos.importe, formaPagoId,
          comprobantes: { create: datos.comprobanteIds.map((comprobanteId) => ({ comprobanteId })) },
        },
      });

      let restante = datos.importe;
      const comprobantes = await tx.compraComprobante.findMany({ where: { id: { in: datos.comprobanteIds } } });
      for (const c of comprobantes) {
        if (restante <= 0) break;
        const aplicar = Math.min(restante, Number(c.saldo));
        const nuevoSaldo = Math.round((Number(c.saldo) - aplicar) * 100) / 100;
        await tx.compraComprobante.update({
          where: { id: c.id },
          data: { saldo: nuevoSaldo, estado: estadoSegunSaldo(nuevoSaldo, Number(c.montoTotal)) },
        });
        restante -= aplicar;
      }

      return pago;
    });
  },
};