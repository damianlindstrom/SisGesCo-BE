import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../common/prisma-client';
import { asyncHandler } from '../../common/async-handler';
import { ok } from '../../common/api-response';

const router = Router();

// GET /api/formas-pago - Obtener todas las formas de pago
router.get('/', asyncHandler(async (_req, res) => {
  const formasPago = await prisma.formaPago.findMany({ orderBy: { id: 'asc' } });
  res.json(ok(formasPago));
}));

// POST /api/formas-pago - Crear una nueva forma de pago
router.post('/', asyncHandler(async (req, res) => {
  const datos = z.object({
    nombre: z.string().min(1),
    descripcion: z.string().optional(),
    activa: z.boolean().optional(),
  }).parse(req.body);

  const nuevaFormaPago = await prisma.formaPago.create({
    data: {
      nombre: datos.nombre,
      descripcion: datos.descripcion,
      activa: datos.activa ?? true,
    },
  });

  res.status(201).json(ok(nuevaFormaPago));
}));

// PATCH /api/formas-pago/:id - Actualizar estado o datos de una forma de pago
router.patch('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const datos = z.object({
    nombre: z.string().min(1).optional(),
    descripcion: z.string().optional().nullable(),
    activa: z.boolean().optional(),
  }).parse(req.body);

  const formaPagoActualizada = await prisma.formaPago.update({
    where: { id },
    data: datos,
  });

  res.json(ok(formaPagoActualizada));
}));

// DELETE /api/formas-pago/:id - Eliminar una forma de pago
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.formaPago.delete({ where: { id } });
  res.json(ok({ deleted: true }));
}));

export default router;