import 'dotenv/config';
import { crearApp } from './app';
import { prisma } from './common/prisma-client';

const app = crearApp();
const PORT = process.env.PORT ?? 3000;

async function testConnection() {
  const result = await prisma.$queryRaw`SELECT DATABASE() as dbName;`;
  console.log('--- CONECTADO ACTUALMENTE A LA BASE DE DATOS:', result);
}
testConnection();

app.listen(PORT, () => {
  console.log(`Sisges backend escuchando en puerto ${PORT}`);
});
