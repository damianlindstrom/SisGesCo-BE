import { prisma } from '../../common/prisma-client';
import { obtenerOCrearFormaPago } from '../../common/catalogos';

interface ImpuestoAplicadoInput { impuestoId: number; monto: number; }
interface GastoInput {
  nombreCorto: string;
  tipo: string;
  descripcion?: string;
  nroComprobante?: string;
  neto?: number;
  noGravado?: number;
  importe: number;
  formaPago: string;
  impuestos?: ImpuestoAplicadoInput[];
}

export const gastosService = {
  async registrar(datos: GastoInput) {
    const formaPagoId = await obtenerOCrearFormaPago(datos.formaPago);

    return prisma.gastoVario.create({
      data: {
        nombreCorto: datos.nombreCorto,
        tipo: datos.tipo,
        descripcion: datos.descripcion,
        nroComprobante: datos.nroComprobante,
        neto: datos.neto ?? 0,
        noGravado: datos.noGravado ?? 0,
        importe: datos.importe,
        formaPagoId,
        impuestos: datos.impuestos?.length
          ? {
              create: datos.impuestos.map((imp) => ({
                impuestoId: imp.impuestoId,
                monto: imp.monto,
              })),
            }
          : undefined,
      },
    });
  },
};