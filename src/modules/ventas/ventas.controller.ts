import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/async-handler';
import { ok } from '../../common/api-response';
import { ventasService } from './ventas.service';

const router = Router();

const impuestoAplicadoSchema = z.object({
  impuestoId: z.number(),
  monto: z.number().nonnegative(),
});

router.post('/', asyncHandler(async (req, res) => {
  const datos = z.object({
    clienteId: z.number(),
    formaPago: z.string().min(1),
    nroComprobante: z.string().optional(),
    neto: z.number().nonnegative().optional().default(0),
    noGravado: z.number().nonnegative().optional().default(0),
    impuestos: z.array(impuestoAplicadoSchema).optional().default([]),
    items: z.array(z.object({
      productoId: z.number(),
      cantidad: z.number().positive(),
      precioUnitario: z.number().nonnegative(),
    })).min(1),
  }).parse(req.body);

  const venta = await ventasService.registrar(datos);
  res.status(201).json(ok(venta));
}));

router.get('/cuenta-corriente/:clienteId', asyncHandler(async (req, res) => {
  const historial = await ventasService.cuentaCorriente(Number(req.params.clienteId));
  res.json(ok(historial));
}));

router.post('/cobros', asyncHandler(async (req, res) => {
  const datos = z.object({
    clienteId: z.number(),
    monto: z.number().positive(),
    formaPago: z.string().min(1),
    observaciones: z.string().optional(),
  }).parse(req.body);

  const historial = await ventasService.registrarCobro(datos);
  res.status(201).json(ok(historial));
}));

router.get('/arqueo', asyncHandler(async (req, res) => {
  const { desde, hasta } = z.object({ desde: z.string(), hasta: z.string() }).parse(req.query);
  const resumen = await ventasService.arqueo(new Date(`${desde}T00:00:00`), new Date(`${hasta}T23:59:59`));
  res.json(ok(resumen));
}));

export default router;