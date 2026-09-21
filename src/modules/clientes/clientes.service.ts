import { prisma } from '../../common/prisma-client';

interface ClientePrismaResult {
  id: number;
  nombre: string;
  dniCuit: string | null;
  categoriaId: number;
  cuentaCorriente: boolean;
  categoria: { nombre: string };
}

function mapear(c: ClientePrismaResult) {
  return { 
    id: c.id, 
    nombre: c.nombre, 
    dniCuit: c.dniCuit, 
    categoriaId: c.categoriaId, 
    cuentaCorriente: c.cuentaCorriente ?? false, 
    categoriaNombre: c.categoria.nombre 
  };
}

export const clientesService = {
  async listar() {
    const clientes = await prisma.cliente.findMany({ 
      include: { categoria: true }, 
      orderBy: { nombre: 'asc' } 
    });
    // Usamos 'as unknown as ClientePrismaResult[]' para asegurar compatibilidad con Prisma
    return (clientes as unknown as ClientePrismaResult[]).map(mapear);
  },

  async crear(datos: { nombre: string; dniCuit?: string; categoriaId: number; cuentaCorriente?: boolean }) {
    const creado = await prisma.cliente.create({
      data: { 
        nombre: datos.nombre, 
        dniCuit: datos.dniCuit, 
        categoriaId: datos.categoriaId,
        cuentaCorriente: datos.cuentaCorriente ?? false 
      },
      include: { categoria: true },
    });
    return mapear(creado as unknown as ClientePrismaResult);
  },
};