import { useCallback, useEffect, useState } from 'react';
import { getProfileView } from '../services/userService';
import type { ProfileView } from '../types/user';
import { getErrorMessage, isPermissionDenied } from '../utils/errors';

export type ProfileState =
  | { status: 'loading' }
  | { status: 'ready'; profile: ProfileView }
  | { status: 'error'; message: string; forbidden: boolean };

/**
 * Perfil de `targetUid`. Para outros usuários, a API só devolve os dados cadastrais se existir
 * conversa individual ou grupo em comum (senão responde 403 e a tela mostra o motivo).
 */
export function useProfile(viewerUid: string, targetUid: string) {
  const [state, setState] = useState<ProfileState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    getProfileView(viewerUid, targetUid)
      .then((profile) => {
        if (!cancelled) setState({ status: 'ready', profile });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ status: 'error', message: getErrorMessage(error), forbidden: isPermissionDenied(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [viewerUid, targetUid, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const updatePhoto = useCallback((photoUrl: string) => {
    setState((current) =>
      current.status === 'ready' ? { status: 'ready', profile: { ...current.profile, photoUrl } } : current,
    );
  }, []);

  return { state, reload, updatePhoto };
}
