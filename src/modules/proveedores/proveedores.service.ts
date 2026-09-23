import { Prisma } from '@prisma/client';
import { prisma } from '../../common/prisma-client';

export const proveedoresService = {
  listar(soloActivos: boolean = false) {
    const where: Prisma.ProveedorWhereInput = soloActivos ? { activo: true } : {};
    return prisma.proveedor.findMany({ 
      where,
      orderBy: { nombre: 'asc' } 
    });
  },

  crear(datos: { nombre: string; cuit?: string; categoria?: string; activo?: boolean }) {
    return prisma.proveedor.create({ 
      data: {
        nombre: datos.nombre,
        cuit: datos.cuit,
        categoria: datos.categoria,
        activo: datos.activo ?? true,
      } 
    });
  },

  actualizar(id: number, datos: { nombre?: string; cuit?: string; categoria?: string; activo?: boolean }) {
    return prisma.proveedor.update({ 
      where: { id },
      data: datos 
    });
  },
};