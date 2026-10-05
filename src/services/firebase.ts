import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase, type Database } from 'firebase/database';
import { connectFirestoreEmulator, getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';
import { Platform } from 'react-native';
import { EMULATOR_HOST, firebaseConfig, isEmulatorMode } from '../config/env';

/**
 * Inicialização única do Firebase (SDK cliente).
 *
 * - Authentication: persistência em AsyncStorage para recuperar a sessão.
 * - Firestore: perfis, grupos, integrantes, limite, política e tokens.
 * - Realtime Database: mensagens (tempo real).
 * - Storage: fotos de perfil e de grupos (somente a URL vai para o Firestore).
 */
export const firebaseApp: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function createAuth(app: FirebaseApp): Auth {
  try {
    return initializeAuth(app, {
      // No navegador (usado só para desenvolvimento) a persistência é a do próprio browser.
      persistence: Platform.OS === 'web' ? browserLocalPersistence : getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Já inicializado (ex.: Fast Refresh em desenvolvimento).
    return getAuth(app);
  }
}

function createFirestore(app: FirebaseApp): Firestore {
  try {
    // Detecta automaticamente redes que bloqueiam o transporte padrão (WebChannel).
    return initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch {
    return getFirestore(app);
  }
}

export const auth: Auth = createAuth(firebaseApp);
export const firestore: Firestore = createFirestore(firebaseApp);
export const realtimeDb: Database = getDatabase(firebaseApp);
export const storage: FirebaseStorage = getStorage(firebaseApp);

if (isEmulatorMode) {
  try {
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(firestore, EMULATOR_HOST, 8080);
    connectDatabaseEmulator(realtimeDb, EMULATOR_HOST, 9000);
    connectStorageEmulator(storage, EMULATOR_HOST, 9199);
  } catch {
    // Os emuladores já foram conectados (recarregamento do módulo em desenvolvimento).
  }
}
