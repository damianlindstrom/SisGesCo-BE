import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Evita repetir try/catch en cada controller. Cualquier error lanzado
 * (o rechazo de promesa) dentro del handler cae acá y se devuelve con
 * el mismo formato ApiError, sin duplicar el try/catch en cada método.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
