import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/async-handler';
import { ok } from '../../common/api-response';
import { gastosService } from './gastos.service';

const router = Router();

const impuestoAplicadoSchema = z.object({
  impuestoId: z.number(),
  monto: z.number().nonnegative(),
});

router.post('/', asyncHandler(async (req, res) => {
  const datos = z.object({
    nombreCorto: z.string().min(1),
    tipo: z.string().min(1),
    descripcion: z.string().optional(),
    nroComprobante: z.string().optional(),
    neto: z.number().nonnegative().optional().default(0),
    noGravado: z.number().nonnegative().optional().default(0),
    importe: z.number().positive(),
    formaPago: z.string().min(1),
    impuestos: z.array(impuestoAplicadoSchema).optional().default([]),
  }).parse(req.body);

  const gasto = await gastosService.registrar(datos);
  res.status(201).json(ok({ id: gasto.id }));
}));

export default router;