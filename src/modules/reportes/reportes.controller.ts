import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/async-handler';
import { ok } from '../../common/api-response';
import { reportesService } from './reportes.service';

const router = Router();

function parseRango(query: unknown) {
  const { desde, hasta } = z.object({ desde: z.string(), hasta: z.string() }).parse(query);
  return { desde: new Date(`${desde}T00:00:00`), hasta: new Date(`${hasta}T23:59:59`) };
}

router.get('/impositivo', asyncHandler(async (req, res) => {
  const { impuestoId, desde, hasta } = z.object({
    impuestoId: z.string(), desde: z.string(), hasta: z.string(),
  }).parse(req.query);
  const reporte = await reportesService.reporteImpositivo(Number(impuestoId), new Date(`${desde}T00:00:00`), new Date(`${hasta}T23:59:59`));
  res.json(ok(reporte));
}));

router.get('/resultado-periodo', asyncHandler(async (req, res) => {
  const { desde, hasta } = parseRango(req.query);
  const resultado = await reportesService.resultadoPeriodo(desde, hasta);
  res.json(ok(resultado));
}));

router.get('/resumen-forma-pago', asyncHandler(async (req, res) => {
  const { formaPagoId, desde, hasta } = z.object({
    formaPagoId: z.string(), desde: z.string(), hasta: z.string(),
  }).parse(req.query);
  const resultado = await reportesService.resumenFormaPago(Number(formaPagoId), new Date(`${desde}T00:00:00`), new Date(`${hasta}T23:59:59`));
  res.json(ok(resultado));
}));

export default router;