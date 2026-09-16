/**
 * Sobre único de respuesta para TODA la API. El front (Angular) tiene
 * un interceptor/tipo que espera exactamente esta forma siempre, así
 * no hay que adivinar la forma de la respuesta endpoint por endpoint
 * (esto es lo que pediste como "lógica de transmisión constante").
 */
export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function ok<T>(data: T): ApiSuccess<T> {
  return { ok: true, data };
}

export function fail(error: unknown): ApiError {
  const mensaje = error instanceof Error ? error.message : String(error);
  return { ok: false, error: mensaje };
}
