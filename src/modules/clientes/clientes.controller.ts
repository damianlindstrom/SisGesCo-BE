import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/async-handler';
import { ok } from '../../common/api-response';
import { clientesService } from './clientes.service';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const soloActivos = req.query.soloActivos === 'true';
  res.json(ok(await clientesService.listar(soloActivos)));
}));

router.post('/', asyncHandler(async (req, res) => {
  const datos = z.object({
    nombre: z.string().min(1),
    dniCuit: z.string().optional(),
    categoriaId: z.number(),
    cuentaCorriente: z.boolean().optional().default(false),
    activo: z.boolean().optional().default(true),
  }).parse(req.body);
  
  const creado = await clientesService.crear(datos);
  res.status(201).json(ok(creado));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const id = z.coerce.number().parse(req.params.id);
  const datos = z.object({
    nombre: z.string().min(1).optional(),
    dniCuit: z.string().optional(),
    categoriaId: z.number().optional(),
    cuentaCorriente: z.boolean().optional(),
    activo: z.boolean().optional(),
  }).parse(req.body);
  
  const actualizado = await clientesService.actualizar(id, datos);
  res.json(ok(actualizado));
}));

export default router;