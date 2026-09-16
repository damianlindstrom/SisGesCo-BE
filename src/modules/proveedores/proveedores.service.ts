import { prisma } from '../../common/prisma-client';

export const proveedoresService = {
  listar() {
    return prisma.proveedor.findMany({ orderBy: { nombre: 'asc' } });
  },

  crear(datos: { nombre: string; cuit?: string; categoria?: string }) {
    return prisma.proveedor.create({ data: datos });
  },
};
