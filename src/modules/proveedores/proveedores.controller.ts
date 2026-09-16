import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/async-handler';
import { ok } from '../../common/api-response';
import { proveedoresService } from './proveedores.service';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  res.json(ok(await proveedoresService.listar()));
}));

router.post('/', asyncHandler(async (req, res) => {
  const datos = z.object({
    nombre: z.string().min(1),
    cuit: z.string().optional(),
    categoria: z.string().optional(),
  }).parse(req.body);
  const creado = await proveedoresService.crear(datos);
  res.status(201).json(ok(creado));
}));

export default router;
