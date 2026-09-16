import 'dotenv/config';
import { crearApp } from './app';

const app = crearApp();
const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`Sisges backend escuchando en puerto ${PORT}`);
});
