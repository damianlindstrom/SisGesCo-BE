import { prisma } from '../../common/prisma-client';
import { obtenerOCrearFormaPago } from '../../common/catalogos';

export const gastosService = {
  async registrar(datos: { nombreCorto: string; tipo: string; descripcion?: string; importe: number; formaPago: string }) {
    const formaPagoId = await obtenerOCrearFormaPago(datos.formaPago);
    return prisma.gastoVario.create({
      data: {
        nombreCorto: datos.nombreCorto, tipo: datos.tipo, descripcion: datos.descripcion,
        importe: datos.importe, formaPagoId,
      },
    });
  },
};
