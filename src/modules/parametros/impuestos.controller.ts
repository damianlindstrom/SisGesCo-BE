import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../common/prisma-client';
import { asyncHandler } from '../../common/async-handler';
import { ok } from '../../common/api-response';

const router = Router();

const parseFecha = (val: unknown) => {
  if (!val || val === '') return null;
  const fecha = new Date(val as string);
  return isNaN(fecha.getTime()) ? null : fecha;
};

// GET /api/impuestos
router.get('/', asyncHandler(async (_req, res) => {
  const impuestos = await prisma.impuesto.findMany({ orderBy: { id: 'asc' } });
  
  const formateados = impuestos.map((imp) => ({
    ...imp,
    alicuota: Number(imp.alicuota),
    // Devolvemos ambos alias para que el front nunca falle visualmente
    fechaDesde: imp.vigenciaDesde,
    fechaHasta: imp.vigenciaHasta,
    enGastosVarios: imp.enGastos,
  }));

  res.json(ok(formateados));
}));

// POST /api/impuestos
router.post('/', asyncHandler(async (req, res) => {
  const body = req.body;

  // Normalizamos los campos antes de validar con Zod para atrapar cualquier variante del front
  const rawData = {
    ...body,
    alicuota: body.alicuota ?? body.porcentaje ?? body.valor ?? 0,
    vigenciaDesde: body.vigenciaDesde ?? body.fechaDesde ?? body.desde ?? null,
    vigenciaHasta: body.vigenciaHasta ?? body.fechaHasta ?? body.hasta ?? null,
    enVentas: body.enVentas ?? false,
    enCompras: body.enCompras ?? false,
    enGastos: body.enGastos ?? body.enGastosVarios ?? false,
    activo: body.activo ?? true,
  };

  const datos = z.object({
    nombre: z.string().min(1),
    alicuota: z.union([z.number(), z.string()]).transform((val) => {
      if (typeof val === 'string') return parseFloat(val) || 0;
      return val;
    }),
    vigenciaDesde: z.any().optional().transform(parseFecha),
    vigenciaHasta: z.any().optional().transform(parseFecha),
    enVentas: z.boolean().optional().default(false),
    enCompras: z.boolean().optional().default(false),
    enGastos: z.boolean().optional().default(false),
    activo: z.boolean().optional().default(true),
  }).parse(rawData);

  const alicuotaDecimal = Number(datos.alicuota) > 1 ? Number(datos.alicuota) / 100 : Number(datos.alicuota);

  const nuevoImpuesto = await prisma.impuesto.create({
    data: {
      nombre: datos.nombre,
      alicuota: alicuotaDecimal,
      vigenciaDesde: datos.vigenciaDesde,
      vigenciaHasta: datos.vigenciaHasta,
      enVentas: datos.enVentas,
      enCompras: datos.enCompras,
      enGastos: datos.enGastos,
      activo: datos.activo,
    },
  });

  res.status(201).json(ok({
    ...nuevoImpuesto,
    alicuota: Number(nuevoImpuesto.alicuota),
    fechaDesde: nuevoImpuesto.vigenciaDesde,
    fechaHasta: nuevoImpuesto.vigenciaHasta,
    enGastosVarios: nuevoImpuesto.enGastos,
  }));
}));

// PATCH /api/impuestos/:id
router.patch('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body;

  // Unificamos variantes que puedan venir del frontend (checks y fechas)
  const rawData = {
    ...body,
    ...(body.fechaDesde !== undefined && { vigenciaDesde: body.fechaDesde }),
    ...(body.fechaHasta !== undefined && { vigenciaHasta: body.fechaHasta }),
    ...((body.enGastosVarios !== undefined || body.enGastos !== undefined) && { 
      enGastos: body.enGastos ?? body.enGastosVarios 
    }),
  };

  const datos = z.object({
    nombre: z.string().optional(),
    alicuota: z.union([z.number(), z.string()]).optional().transform((val) => {
      if (typeof val === 'string') return parseFloat(val) || 0;
      return val;
    }),
    vigenciaDesde: z.any().optional().transform(parseFecha),
    vigenciaHasta: z.any().optional().transform(parseFecha),
    enVentas: z.boolean().optional(),
    enCompras: z.boolean().optional(),
    enGastos: z.boolean().optional(),
    activo: z.boolean().optional(),
  }).parse(rawData);

  const payload: Record<string, unknown> = { ...datos };

  if (datos.alicuota !== undefined) {
    payload.alicuota = Number(datos.alicuota) > 1 ? Number(datos.alicuota) / 100 : Number(datos.alicuota);
  }

  const actualizado = await prisma.impuesto.update({
    where: { id },
    data: payload,
  });

  res.json(ok({
    ...actualizado,
    alicuota: Number(actualizado.alicuota),
    fechaDesde: actualizado.vigenciaDesde,
    fechaHasta: actualizado.vigenciaHasta,
    enGastosVarios: actualizado.enGastos,
  }));
}));

// DELETE /api/impuestos/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  await prisma.gastoImpuesto.deleteMany({ where: { impuestoId: id } }).catch(() => {});
  await prisma.ventaImpuesto.deleteMany({ where: { impuestoId: id } }).catch(() => {});
  await prisma.compraImpuesto.deleteMany({ where: { impuestoId: id } }).catch(() => {});

  await prisma.impuesto.delete({ where: { id } });
  res.json(ok({ deleted: true }));
}));

export default router;