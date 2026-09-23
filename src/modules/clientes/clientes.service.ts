import { Prisma } from '@prisma/client';
import { prisma } from '../../common/prisma-client';

interface ClientePrismaResult {
  id: number;
  nombre: string;
  dniCuit: string | null;
  categoriaId: number;
  cuentaCorriente: boolean;
  activo: boolean;
  categoria: { nombre: string };
}

function mapear(c: ClientePrismaResult) {
  return { 
    id: c.id, 
    nombre: c.nombre, 
    dniCuit: c.dniCuit, 
    categoriaId: c.categoriaId, 
    cuentaCorriente: c.cuentaCorriente ?? false, 
    activo: c.activo ?? true,
    categoriaNombre: c.categoria.nombre 
  };
}

export const clientesService = {
  async listar(soloActivos: boolean = false) {
    const where: Prisma.ClienteWhereInput = soloActivos ? { activo: true } : {};
    const clientes = await prisma.cliente.findMany({ 
      where,
      include: { categoria: true }, 
      orderBy: { nombre: 'asc' } 
    });
    return (clientes as unknown as ClientePrismaResult[]).map(mapear);
  },

  async crear(datos: { nombre: string; dniCuit?: string; categoriaId: number; cuentaCorriente?: boolean; activo?: boolean }) {
    const creado = await prisma.cliente.create({
      data: { 
        nombre: datos.nombre, 
        dniCuit: datos.dniCuit, 
        categoriaId: datos.categoriaId,
        cuentaCorriente: datos.cuentaCorriente ?? false,
        activo: datos.activo ?? true,
      },
      include: { categoria: true },
    });
    return mapear(creado as unknown as ClientePrismaResult);
  },

  async actualizar(id: number, datos: { nombre?: string; dniCuit?: string; categoriaId?: number; cuentaCorriente?: boolean; activo?: boolean }) {
    const actualizado = await prisma.cliente.update({
      where: { id },
      data: {
        nombre: datos.nombre,
        dniCuit: datos.dniCuit,
        categoriaId: datos.categoriaId,
        cuentaCorriente: datos.cuentaCorriente,
        activo: datos.activo,
      },
      include: { categoria: true },
    });
    return mapear(actualizado as unknown as ClientePrismaResult);
  },
};