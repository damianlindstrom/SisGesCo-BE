import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/async-handler';
import { ok } from '../../common/api-response';
import { comprasService } from './compras.service';

const router = Router();

const tipoEnum = z.enum(['FACTURA_MERCADERIA', 'NOTA_DEBITO', 'NOTA_CREDITO']);

const impuestoAplicadoSchema = z.object({
  impuestoId: z.number(),
  monto: z.number().nonnegative(),
});

router.post('/comprobantes', asyncHandler(async (req, res) => {
  const datos = z.object({
    proveedorId: z.number(),
    tipo: tipoEnum,
    nroComprobante: z.string().min(1),
    detalle: z.string().optional(),
    neto: z.number().nonnegative().optional().default(0),
    noGravado: z.number().nonnegative().optional().default(0),
    impuestos: z.array(impuestoAplicadoSchema).optional().default([]),
    items: z.array(z.object({
      productoNombre: z.string().min(1),
      cantidad: z.number().positive(),
      costoUnitario: z.number().nonnegative(),
    })).optional(),
    comprobanteVinculadoId: z.number().optional(),
  }).parse(req.body);

  const comprobante = await comprasService.registrarComprobante(datos);
  res.status(201).json(ok(comprobante));
}));

router.get('/comprobantes/pendientes/:proveedorId', asyncHandler(async (req, res) => {
  const comprobantes = await comprasService.comprobantesPendientes(Number(req.params.proveedorId));
  res.json(ok(comprobantes));
}));

router.post('/pagos', asyncHandler(async (req, res) => {
  const datos = z.object({
    proveedorId: z.number(),
    comprobanteIds: z.array(z.number()).min(1),
    importe: z.number().positive(),
    formaPago: z.string().min(1),
  }).parse(req.body);

  const pago = await comprasService.registrarPago(datos);
  res.status(201).json(ok(pago));
}));

export default router;