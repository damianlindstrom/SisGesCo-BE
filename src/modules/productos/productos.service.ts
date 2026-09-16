import { prisma } from '../../common/prisma-client';

/**
 * Misma fórmula que calcularPrecio() en el Codigo.gs original.
 * Vive en un único lugar: el service. Nadie más la reimplementa.
 */
function calcularPrecio(costo: number, porcentaje: number): number {
  return Math.round(((costo / 1.245) * porcentaje) * 1.245 * 100) / 100;
}

export interface ProductoConPrecios {
  id: number;
  nombre: string;
  rubro: string | null;
  tipo: string | null;
  stock: number;
  costo: number;
  precioRespInsc: number;
  precioConsFinal: number;
  precioCtaCte: number;
}

function mapearConPrecios(p: {
  id: number; nombre: string; rubro: string | null; tipo: string | null;
  stock: any; costo: any; pctRespInsc: any; pctConsFinal: any; pctCtaCte: any;
}): ProductoConPrecios {
  const costo = Number(p.costo);
  return {
    id: p.id,
    nombre: p.nombre,
    rubro: p.rubro,
    tipo: p.tipo,
    stock: Number(p.stock),
    costo,
    precioRespInsc: calcularPrecio(costo, Number(p.pctRespInsc)),
    precioConsFinal: calcularPrecio(costo, Number(p.pctConsFinal)),
    precioCtaCte: calcularPrecio(costo, Number(p.pctCtaCte)),
  };
}

export const productosService = {
  async listar(): Promise<ProductoConPrecios[]> {
    const productos = await prisma.producto.findMany({ orderBy: { nombre: 'asc' } });
    return productos.map(mapearConPrecios);
  },

  async obtener(id: number): Promise<ProductoConPrecios | null> {
    const p = await prisma.producto.findUnique({ where: { id } });
    return p ? mapearConPrecios(p) : null;
  },

  async crear(datos: {
    nombre: string; rubro?: string; tipo?: string; stock?: number; costo: number;
    pctRespInsc: number; pctConsFinal: number; pctCtaCte: number;
  }) {
    const creado = await prisma.producto.create({
      data: {
        nombre: datos.nombre,
        rubro: datos.rubro,
        tipo: datos.tipo,
        stock: datos.stock ?? 0,
        costo: datos.costo,
        pctRespInsc: datos.pctRespInsc,
        pctConsFinal: datos.pctConsFinal,
        pctCtaCte: datos.pctCtaCte,
      },
    });
    return mapearConPrecios(creado);
  },

  // Reemplaza actualizarStock(): ajusta cantidad y opcionalmente el costo.
  async ajustarStock(id: number, cantidadDelta: number, nuevoCosto?: number) {
    const actualizado = await prisma.producto.update({
      where: { id },
      data: {
        stock: { increment: cantidadDelta },
        ...(nuevoCosto !== undefined ? { costo: nuevoCosto } : {}),
      },
    });
    return mapearConPrecios(actualizado);
  },

  // Edición completa desde la pantalla de administración de productos
  // (a diferencia de ajustarStock, acá se pisan todos los campos).
  async actualizar(id: number, datos: {
    nombre: string; rubro?: string; tipo?: string; stock: number; costo: number;
    pctRespInsc: number; pctConsFinal: number; pctCtaCte: number;
  }) {
    const actualizado = await prisma.producto.update({
      where: { id },
      data: {
        nombre: datos.nombre,
        rubro: datos.rubro,
        tipo: datos.tipo,
        stock: datos.stock,
        costo: datos.costo,
        pctRespInsc: datos.pctRespInsc,
        pctConsFinal: datos.pctConsFinal,
        pctCtaCte: datos.pctCtaCte,
      },
    });
    return mapearConPrecios(actualizado);
  },
};
