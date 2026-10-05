import type { Persistence } from 'firebase/auth';

/**
 * O Firebase JS SDK exporta `getReactNativePersistence` no build React Native (resolvido pelo Metro
 * em tempo de execução), mas os tipos de `firebase/auth` não o declaram. Esta declaração descreve
 * a função existente — não adiciona nenhum código.
 */
declare module 'firebase/auth' {
  interface ReactNativeAsyncStorage {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }

  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
