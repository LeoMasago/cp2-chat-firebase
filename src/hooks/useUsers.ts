import { useEffect, useMemo, useState } from 'react';
import { getPublicProfiles, subscribeUsers } from '../services/userService';
import type { PublicProfile } from '../types/user';
import { getErrorMessage } from '../utils/errors';

/** Usuários cadastrados (exceto o próprio), em tempo real. */
export function useUsers(currentUid: string) {
  const [allUsers, setAllUsers] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    return subscribeUsers(
      (users) => {
        setAllUsers(users);
        setLoading(false);
      },
      (subscriptionError) => {
        setError(getErrorMessage(subscriptionError));
        setLoading(false);
      },
    );
  }, [reloadKey]);

  // Estado derivado: nunca mutamos a lista original; o próprio usuário não pode ser selecionado.
  const users = useMemo(() => allUsers.filter((user) => user.uid !== currentUid), [allUsers, currentUid]);

  return { users, loading, error, retry: () => setReloadKey((key) => key + 1) };
}

/**
 * Perfis públicos (nome e foto) de uma lista de `uid`, com cache.
 * Usado para exibir autores de mensagens, integrantes e o outro participante de conversas individuais.
 */
export function usePublicProfiles(uids: readonly string[]): Record<string, PublicProfile> {
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const key = useMemo(() => [...new Set(uids)].sort().join(','), [uids]);

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    getPublicProfiles(key.split(','))
      .then((loaded) => {
        if (cancelled) return;
        setProfiles((previous) => ({
          ...previous,
          ...Object.fromEntries(loaded.map((profile) => [profile.uid, profile])),
        }));
      })
      .catch(() => undefined); // sem o perfil, a interface usa o nome e a foto padrão
    return () => {
      cancelled = true;
    };
  }, [key]);

  return profiles;
}
