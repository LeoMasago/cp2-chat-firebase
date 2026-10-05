import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { observeAuthState, registerWithEmail, signInWithEmail, signOutUser } from '../services/authService';
import { unregisterDevice } from '../services/notificationService';
import { subscribePrivateProfile, subscribePublicProfile } from '../services/userService';
import type { PrivateProfile, PublicProfile, RegisterInput, RegisterResult, ChatUser } from '../types/user';
import { getErrorMessage } from '../utils/errors';

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'error';

export type AuthContextValue = {
  status: AuthStatus;
  /** Usuário autenticado com perfil completo; `null` enquanto carrega ou após o logout. */
  user: ChatUser | null;
  /** Mensagem do erro que impede o uso do app (ex.: perfil não encontrado). */
  errorMessage: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

/** Tempo máximo esperando o perfil existir no Firestore antes de tratar como erro. */
const PROFILE_WAIT_MS = 10_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  // `undefined` = ainda recuperando a sessão; `null` = sem sessão.
  const [authUid, setAuthUid] = useState<string | null | undefined>(undefined);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null | undefined>(undefined);
  const [privateProfile, setPrivateProfile] = useState<PrivateProfile | null | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const registering = useRef(false);

  // Sessão: o Firebase restaura o usuário salvo (AsyncStorage) e avisa a cada login/logout.
  useEffect(() => observeAuthState((firebaseUser) => setAuthUid(firebaseUser?.uid ?? null)), []);

  // Perfil (Firestore) do usuário autenticado, em tempo real. Os listeners são removidos no logout.
  useEffect(() => {
    setPublicProfile(undefined);
    setPrivateProfile(undefined);
    setErrorMessage(null);
    if (!authUid) return undefined;

    const onError = (error: unknown) => setErrorMessage(getErrorMessage(error));
    const unsubscribePublic = subscribePublicProfile(authUid, setPublicProfile, onError);
    const unsubscribePrivate = subscribePrivateProfile(authUid, setPrivateProfile, onError);
    return () => {
      unsubscribePublic();
      unsubscribePrivate();
    };
  }, [authUid]);

  // Conta existe no Authentication mas o perfil não apareceu no Firestore: evita carregar para sempre.
  useEffect(() => {
    const profileMissing = publicProfile === null || privateProfile === null;
    if (!authUid || !profileMissing || registering.current) return undefined;
    const timer = setTimeout(() => {
      if (!registering.current) {
        setErrorMessage('Não encontramos o perfil desta conta. Saia e tente entrar novamente.');
      }
    }, PROFILE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [authUid, publicProfile, privateProfile]);

  const user = useMemo<ChatUser | null>(() => {
    if (!authUid || !publicProfile || !privateProfile || publicProfile.uid !== authUid) return null;
    return { ...publicProfile, ...privateProfile };
  }, [authUid, publicProfile, privateProfile]);

  const status: AuthStatus =
    authUid === undefined
      ? 'loading'
      : authUid === null
        ? 'unauthenticated'
        : errorMessage
          ? 'error'
          : user
            ? 'authenticated'
            : 'loading';

  const signIn = useCallback((email: string, password: string) => signInWithEmail(email, password), []);

  const register = useCallback(async (input: RegisterInput): Promise<RegisterResult> => {
    registering.current = true;
    try {
      return await registerWithEmail(input);
    } finally {
      registering.current = false;
    }
  }, []);

  const signOut = useCallback(async () => {
    // Para de receber push neste aparelho antes de encerrar a sessão (ainda autenticado).
    if (authUid) await unregisterDevice(authUid).catch(() => undefined);
    await signOutUser();
  }, [authUid]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, errorMessage, signIn, register, signOut }),
    [status, user, errorMessage, signIn, register, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
