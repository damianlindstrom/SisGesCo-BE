import { Router } from 'express';
import { asyncHandler } from '../../common/async-handler';
import { ok } from '../../common/api-response';
import { prisma } from '../../common/prisma-client';

const router = Router();

// Igual que categorías: catálogo de solo lectura por ahora. Agregar un
// impuesto nuevo (con su alícuota) alcanza para que aparezca en el
// selector de Reportes sin tocar el front.
router.get('/', asyncHandler(async (_req, res) => {
  const impuestos = await prisma.impuesto.findMany({ orderBy: { id: 'asc' } });
  res.json(ok(impuestos.map((i) => ({ id: i.id, nombre: i.nombre }))));
}));

export default router;
