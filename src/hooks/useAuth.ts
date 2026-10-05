import { useContext, useRef } from 'react';
import { AuthContext, type AuthContextValue } from '../contexts/AuthContext';
import type { ChatUser } from '../types/user';

/** Acesso à sessão e às ações de autenticação (login, cadastro e logout). */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  return context;
}

/**
 * Usuário autenticado, para telas protegidas (renderizadas só após o login).
 * Durante o logout a tela ainda pode renderizar uma última vez antes de ser removida;
 * por isso o último usuário válido é mantido em vez de lançar erro.
 */
export function useCurrentUser(): ChatUser {
  const { user } = useAuth();
  const lastUser = useRef<ChatUser | null>(user);
  if (user) lastUser.current = user;
  if (!lastUser.current) throw new Error('useCurrentUser exige um usuário autenticado.');
  return lastUser.current;
}
