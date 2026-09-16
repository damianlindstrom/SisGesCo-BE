import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/async-handler';
import { ok } from '../../common/api-response';
import { clientesService } from './clientes.service';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  res.json(ok(await clientesService.listar()));
}));

router.post('/', asyncHandler(async (req, res) => {
  const datos = z.object({
    nombre: z.string().min(1),
    dniCuit: z.string().optional(),
    categoriaId: z.number(),
  }).parse(req.body);
  const creado = await clientesService.crear(datos);
  res.status(201).json(ok(creado));
}));

export default router;
