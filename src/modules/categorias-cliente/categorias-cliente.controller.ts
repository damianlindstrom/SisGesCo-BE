import { Router } from 'express';
import { asyncHandler } from '../../common/async-handler';
import { ok } from '../../common/api-response';
import { prisma } from '../../common/prisma-client';

const router = Router();

// Catálogo simple, de solo lectura desde el front (se administra por ahora
// directo en la base — no hay pantalla de alta de categorías todavía).
router.get('/', asyncHandler(async (_req, res) => {
  const categorias = await prisma.categoriaCliente.findMany({ orderBy: { id: 'asc' } });
  res.json(ok(categorias));
}));

export default router;
