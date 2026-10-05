import { Expo } from 'expo-server-sdk';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { adminServices, initFirebaseAdmin } from './services/firebaseAdmin.js';
import { createFirebaseStore } from './services/firebaseStore.js';
import { createPushSender } from './services/notificationSender.js';

const config = loadConfig();
const services = adminServices(initFirebaseAdmin(config.firebase));

const app = createApp({
  auth: {
    // `true` também rejeita tokens de sessões revogadas.
    verifyIdToken: (idToken) => services.auth.verifyIdToken(idToken, true),
  },
  store: createFirebaseStore(services),
  push: createPushSender(
    services.messaging,
    new Expo(config.expoAccessToken ? { accessToken: config.expoAccessToken } : {}),
  ),
  includePreview: config.notificationPreview,
  trustProxy: config.trustProxy,
  version: process.env['npm_package_version'] ?? '1.0.0',
});

app.listen(config.port, () => {
  console.log(`API de chat ouvindo na porta ${config.port}`);
});
