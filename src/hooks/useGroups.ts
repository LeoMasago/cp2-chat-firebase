import { useEffect, useState } from 'react';
import { subscribeGroup, subscribeUserGroups } from '../services/groupService';
import type { ChatGroup } from '../types/group';
import { getErrorMessage, isPermissionDenied } from '../utils/errors';

/** Grupos dos quais o usuário participa, em tempo real. */
export function useUserGroups(uid: string) {
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    return subscribeUserGroups(
      uid,
      (loaded) => {
        setGroups(loaded);
        setLoading(false);
      },
      (subscriptionError) => {
        setError(getErrorMessage(subscriptionError));
        setLoading(false);
      },
    );
  }, [uid, reloadKey]);

  return { groups, loading, error, retry: () => setReloadKey((key) => key + 1) };
}

export type GroupState =
  /** Nenhum `groupId` informado (ex.: formulário de criação). */
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; group: ChatGroup }
  /** O grupo não existe mais ou o usuário foi removido (as regras bloqueiam a leitura). */
  | { status: 'removed' }
  | { status: 'error'; message: string };

/** Um grupo específico em tempo real (nome, foto, integrantes, limite, política). */
export function useGroup(groupId: string | undefined): GroupState {
  const [state, setState] = useState<GroupState>(groupId ? { status: 'loading' } : { status: 'idle' });

  useEffect(() => {
    if (!groupId) {
      setState({ status: 'idle' });
      return undefined;
    }
    setState({ status: 'loading' });
    return subscribeGroup(
      groupId,
      (group) => setState(group ? { status: 'ready', group } : { status: 'removed' }),
      (error) =>
        setState(isPermissionDenied(error) ? { status: 'removed' } : { status: 'error', message: getErrorMessage(error) }),
    );
  }, [groupId]);

  return state;
}
