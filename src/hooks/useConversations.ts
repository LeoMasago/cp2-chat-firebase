import { useEffect, useMemo, useState } from 'react';
import { subscribeDirectConversations, subscribeLastMessage } from '../services/chatService';
import type { ConversationSummary, DirectConversation, LastMessage } from '../types/chat';
import { getErrorMessage } from '../utils/errors';
import { useUserGroups } from './useGroups';
import { usePublicProfiles } from './useUsers';

function useDirectConversations(uid: string) {
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    return subscribeDirectConversations(
      uid,
      (loaded) => {
        setConversations(loaded);
        setLoading(false);
      },
      (subscriptionError) => {
        setError(getErrorMessage(subscriptionError));
        setLoading(false);
      },
    );
  }, [uid, reloadKey]);

  return { conversations, loading, error, retry: () => setReloadKey((key) => key + 1) };
}

/** Uma assinatura por conversa para acompanhar a última mensagem em tempo real. */
function useLastMessages(conversationIds: readonly string[]): Record<string, LastMessage | null> {
  const [lastMessages, setLastMessages] = useState<Record<string, LastMessage | null>>({});
  const key = useMemo(() => [...conversationIds].sort().join(','), [conversationIds]);

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    const unsubscribers = ids.map((conversationId) =>
      subscribeLastMessage(
        conversationId,
        (message) => setLastMessages((previous) => ({ ...previous, [conversationId]: message })),
        () => undefined, // sem permissão/conexão: a conversa aparece sem pré-visualização
      ),
    );
    // Remove todos os listeners ao trocar a lista de conversas ou ao sair da tela.
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [key]);

  return lastMessages;
}

/** Lista unificada (individuais + grupos), ordenada pela atividade mais recente. */
export function useConversations(uid: string) {
  const groupsState = useUserGroups(uid);
  const directState = useDirectConversations(uid);

  const peerIds = useMemo(
    () =>
      directState.conversations
        .map((conversation) => conversation.participantIds.find((id) => id !== uid))
        .filter((id): id is string => id !== undefined),
    [directState.conversations, uid],
  );
  const peerProfiles = usePublicProfiles(peerIds);

  const conversationIds = useMemo(
    () => [...groupsState.groups.map((group) => group.id), ...directState.conversations.map((c) => c.id)],
    [groupsState.groups, directState.conversations],
  );
  const lastMessages = useLastMessages(conversationIds);

  const items = useMemo<ConversationSummary[]>(() => {
    const groupItems = groupsState.groups.map<ConversationSummary>((group) => {
      const lastMessage = lastMessages[group.id] ?? null;
      return {
        id: group.id,
        type: 'group',
        title: group.name,
        photoUrl: group.photoUrl,
        peerId: null,
        lastMessage,
        sortKey: lastMessage?.createdAt ?? group.updatedAt,
      };
    });
    const directItems = directState.conversations.map<ConversationSummary>((conversation) => {
      const peerId = conversation.participantIds.find((id) => id !== uid) ?? null;
      const peer = peerId ? peerProfiles[peerId] : undefined;
      const lastMessage = lastMessages[conversation.id] ?? null;
      return {
        id: conversation.id,
        type: 'direct',
        title: peer?.name ?? 'Usuário',
        photoUrl: peer?.photoUrl ?? '',
        peerId,
        lastMessage,
        sortKey: lastMessage?.createdAt ?? conversation.createdAt,
      };
    });
    return [...groupItems, ...directItems].sort((a, b) => b.sortKey - a.sortKey);
  }, [groupsState.groups, directState.conversations, lastMessages, peerProfiles, uid]);

  return {
    items,
    loading: groupsState.loading || directState.loading,
    error: groupsState.error ?? directState.error,
    retry: () => {
      groupsState.retry();
      directState.retry();
    },
  };
}
