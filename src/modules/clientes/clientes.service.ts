import { prisma } from '../../common/prisma-client';

function mapear(c: { id: number; nombre: string; dniCuit: string | null; categoriaId: number; categoria: { nombre: string } }) {
  return { id: c.id, nombre: c.nombre, dniCuit: c.dniCuit, categoriaId: c.categoriaId, categoriaNombre: c.categoria.nombre };
}

export const clientesService = {
  async listar() {
    const clientes = await prisma.cliente.findMany({ include: { categoria: true }, orderBy: { nombre: 'asc' } });
    return clientes.map(mapear);
  },

  async crear(datos: { nombre: string; dniCuit?: string; categoriaId: number }) {
    const creado = await prisma.cliente.create({
      data: { nombre: datos.nombre, dniCuit: datos.dniCuit, categoriaId: datos.categoriaId },
      include: { categoria: true },
    });
    return mapear(creado);
  },
};
