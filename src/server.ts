import 'dotenv/config';

const token = process.env.GITHUB_TOKEN;

if (!token) {
  console.error('[FATAL] GITHUB_TOKEN no está configurado. Copiá .env.example a .env y completá el token.');
  process.exit(1);
}

console.error('[INFO] Entorno cargado correctamente. GITHUB_TOKEN presente.');
