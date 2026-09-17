import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../common/prisma-client';
import { asyncHandler } from '../../common/async-handler';
import { ok } from '../../common/api-response';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const formasPago = await prisma.formaPago.findMany({ orderBy: { id: 'asc' } });
  res.json(ok(formasPago));
}));

router.post('/', asyncHandler(async (req, res) => {
  const datos = z.object({
    nombre: z.string().min(1),
  }).parse(req.body);

  const nuevaFormaPago = await prisma.formaPago.create({
    data: { nombre: datos.nombre },
  });

  res.status(201).json(ok(nuevaFormaPago));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.formaPago.delete({ where: { id } });
  res.json(ok({ deleted: true }));
}));

export default router;