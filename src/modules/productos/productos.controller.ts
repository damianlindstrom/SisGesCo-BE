import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/async-handler';
import { ok } from '../../common/api-response';
import { productosService } from './productos.service';

const router = Router();

const productoSchema = z.object({
  nombre: z.string().min(1),
  rubro: z.string().optional(),
  tipo: z.string().optional(),
  stock: z.number().optional(),
  costo: z.number().nonnegative(),
  pctRespInsc: z.number(),
  pctConsFinal: z.number(),
  pctCtaCte: z.number(),
});

router.get('/', asyncHandler(async (_req, res) => {
  const productos = await productosService.listar();
  res.json(ok(productos));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const producto = await productosService.obtener(Number(req.params.id));
  res.json(ok(producto));
}));

router.post('/', asyncHandler(async (req, res) => {
  const datos = productoSchema.parse(req.body);
  const creado = await productosService.crear(datos);
  res.status(201).json(ok(creado));
}));

router.patch('/:id/stock', asyncHandler(async (req, res) => {
  const { cantidadDelta, nuevoCosto } = z.object({
    cantidadDelta: z.number(),
    nuevoCosto: z.number().optional(),
  }).parse(req.body);
  const actualizado = await productosService.ajustarStock(Number(req.params.id), cantidadDelta, nuevoCosto);
  res.json(ok(actualizado));
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const datos = productoSchema.extend({ stock: z.number() }).parse(req.body);
  const actualizado = await productosService.actualizar(Number(req.params.id), datos);
  res.json(ok(actualizado));
}));

export default router;
