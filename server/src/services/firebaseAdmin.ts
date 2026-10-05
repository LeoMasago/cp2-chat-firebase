import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import type { AppConfig } from '../config.js';

/**
 * Inicializa o Firebase Admin SDK com a conta de serviço configurada nas
 * variáveis secretas da hospedagem. Nada aqui é lido de arquivo versionado.
 */
export function initFirebaseAdmin(config: AppConfig['firebase']): App {
  const existing = getApps()[0];
  if (existing) return existing;
  return initializeApp({
    credential: cert({
      projectId: config.projectId,
      clientEmail: config.clientEmail,
      privateKey: config.privateKey,
    }),
    databaseURL: config.databaseURL,
  });
}

/**
 * Variante sem credencial, usada apenas com o Firebase Emulator nos testes de integração
 * (as variáveis `*_EMULATOR_HOST` apontam o Admin SDK para os emuladores).
 */
export function initEmulatorApp(options: { projectId: string; databaseURL: string }, name: string): App {
  return initializeApp(options, name);
}

export function adminServices(app: App) {
  return {
    auth: getAuth(app),
    firestore: getFirestore(app),
    database: getDatabase(app),
    messaging: getMessaging(app),
  };
}

export type AdminServices = ReturnType<typeof adminServices>;
