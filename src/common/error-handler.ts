import { Request, Response, NextFunction } from 'express';
import { fail } from './api-response';

// Middleware final: cualquier error no manejado llega acá y sale con
// el mismo sobre { ok: false, error } que usa el resto de la API.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  res.status(500).json(fail(err));
}
