/**
 * Servidor de DESENVOLVIMENTO: sobe a mesma API contra o Firebase Emulator Suite, sem conta de
 * serviço e sem enviar push de verdade (o envio é apenas registrado no console).
 *
 * Uso (com os emuladores rodando e as variáveis *_EMULATOR_HOST definidas):
 *   npm run dev:emulator
 *
 * Nunca use isto em produção: não há credencial administrativa e o push é simulado.
 */
import express from 'express';
import { createApp } from '../app.js';
import { adminServices, initEmulatorApp } from '../services/firebaseAdmin.js';
import { createFirebaseStore } from '../services/firebaseStore.js';
import type { PushSender } from '../services/notificationSender.js';

const projectId = process.env['GCLOUD_PROJECT'] ?? 'demo-cp2';
const databaseHost = process.env['FIREBASE_DATABASE_EMULATOR_HOST'] ?? '127.0.0.1:9000';
const port = Number(process.env['PORT'] ?? 3001);

for (const variable of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_DATABASE_EMULATOR_HOST']) {
  if (!process.env[variable]) {
    console.error(`Defina ${variable} (ex.: execute dentro de "firebase emulators:exec" ou exporte manualmente).`);
    process.exit(1);
  }
}

const services = adminServices(
  initEmulatorApp({ projectId, databaseURL: `http://${databaseHost}?ns=${projectId}-default-rtdb` }, 'dev-emulator'),
);

const loggingPush: PushSender = {
  async send(devices, content) {
    console.log(`[push simulado] "${content.title}" — ${content.body} → ${devices.length} dispositivo(s)`, content.data);
    return { sent: devices.length, failed: 0, invalidDevices: [] };
  },
};

const api = createApp({
  auth: { verifyIdToken: (token) => services.auth.verifyIdToken(token, true) },
  store: createFirebaseStore(services),
  push: loggingPush,
  includePreview: true,
  trustProxy: 0,
  version: 'dev-emulator',
});

// Somente para a pré-visualização web em desenvolvimento: navegadores exigem CORS (apps nativos não).
const dev = express();
dev.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (request.method === 'OPTIONS') {
    response.sendStatus(204);
    return;
  }
  next();
});
dev.use(api);

dev.listen(port, () => {
  console.log(`API (emuladores) em http://127.0.0.1:${port}`);
});
