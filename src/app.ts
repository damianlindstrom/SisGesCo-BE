import express from 'express';
import cors from 'cors';
import { errorHandler } from './common/error-handler';
import productosRouter from './modules/productos/productos.controller';
import categoriasClienteRouter from './modules/categorias-cliente/categorias-cliente.controller';
import impuestosRouter from './modules/impuestos/impuestos.controller';
import clientesRouter from './modules/clientes/clientes.controller';
import proveedoresRouter from './modules/proveedores/proveedores.controller';
import ventasRouter from './modules/ventas/ventas.controller';
import comprasRouter from './modules/compras/compras.controller';
import gastosRouter from './modules/gastos/gastos.controller';
import reportesRouter from './modules/reportes/reportes.controller';

export function crearApp() {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
  app.use(express.json());

  app.use('/api/productos', productosRouter);
  app.use('/api/categorias-cliente', categoriasClienteRouter);
  app.use('/api/impuestos', impuestosRouter);
  app.use('/api/clientes', clientesRouter);
  app.use('/api/proveedores', proveedoresRouter);
  app.use('/api/ventas', ventasRouter);
  app.use('/api/compras', comprasRouter);
  app.use('/api/gastos', gastosRouter);
  app.use('/api/reportes', reportesRouter);

  app.use(errorHandler);
  return app;
}
