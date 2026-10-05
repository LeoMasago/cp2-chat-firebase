import type { FirebaseOptions } from 'firebase/app';
import realFirebaseConfig from '../../firebaseConfig.json';

/** URL pública da API de notificações (definida em `.env` → `EXPO_PUBLIC_API_URL`). */
export const API_URL: string = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

/**
 * Modo emulador (somente desenvolvimento): com `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST` definido
 * (ex.: `127.0.0.1`, ou `10.0.2.2` no emulador Android), o app usa o Firebase Emulator Suite
 * em vez do projeto real. Veja o README, seção "Desenvolvimento com emuladores".
 */
export const EMULATOR_HOST: string = (process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST ?? '').trim();
export const isEmulatorMode: boolean = EMULATOR_HOST.length > 0;

const emulatorFirebaseConfig: FirebaseOptions = {
  apiKey: 'emulator-api-key',
  authDomain: 'demo-cp2.firebaseapp.com',
  databaseURL: 'https://demo-cp2-default-rtdb.firebaseio.com',
  projectId: 'demo-cp2',
  storageBucket: 'demo-cp2.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:emulator',
};

/** Configuração do SDK cliente: `firebaseConfig.json` (projeto real) ou a do emulador. */
export const firebaseConfig: FirebaseOptions = isEmulatorMode ? emulatorFirebaseConfig : realFirebaseConfig;

const PLACEHOLDER_MARKERS = ['COLE_AQUI', 'seu-project-id', '000000000000'];

/** `true` quando o `firebaseConfig.json` foi preenchido com os dados reais do projeto (ou o modo emulador está ativo). */
export const isFirebaseConfigured: boolean =
  isEmulatorMode ||
  Object.values(realFirebaseConfig).every(
    (value) =>
      typeof value === 'string' && value.length > 0 && !PLACEHOLDER_MARKERS.some((marker) => value.includes(marker)),
  );

export const isApiConfigured: boolean = API_URL.startsWith('http') && !API_URL.includes('sua-api');
