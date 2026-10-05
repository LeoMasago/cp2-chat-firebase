import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { sendMessage, subscribeConnection, subscribeMessages } from '../services/chatService';
import type { ChatMessage, ConversationType, OutgoingMessage } from '../types/chat';
import { getErrorMessage, isPermissionDenied } from '../utils/errors';

export type ChatStatus = 'loading' | 'ready' | 'error';

export type FailedSend = { message: OutgoingMessage; error: string };

type UseChatParams = {
  conversationId: string;
  conversationType: ConversationType;
  userId: string;
};

const PUSH_WARNING_MS = 6_000;
const PUSH_WARNING_TEXT = 'Mensagem enviada, mas não foi possível disparar a notificação push agora.';

/**
 * Mensagens de uma conversa em tempo real (Realtime Database) e envio.
 * O listener é criado ao abrir a conversa e removido ao fechá-la ou trocar de conversa.
 */
export function useChat({ conversationId, conversationType, userId }: UseChatParams) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [failedSend, setFailedSend] = useState<FailedSend | null>(null);
  const [pushWarning, setPushWarning] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setStatus('loading');
    setError(null);
    setMessages([]);
    return subscribeMessages(
      conversationId,
      (loaded) => {
        setMessages(loaded);
        setStatus('ready');
      },
      (subscriptionError) => {
        setError(
          isPermissionDenied(subscriptionError)
            ? 'Você não tem acesso às mensagens desta conversa. Se acabou de entrar no grupo, aguarde alguns segundos e tente novamente.'
            : getErrorMessage(subscriptionError),
        );
        setStatus('error');
      },
    );
  }, [conversationId, reloadKey]);

  // O aviso de push some sozinho.
  useEffect(() => {
    if (!pushWarning) return undefined;
    const timer = setTimeout(() => setPushWarning(null), PUSH_WARNING_MS);
    return () => clearTimeout(timer);
  }, [pushWarning]);

  /** Depois que a mensagem foi salva, pede à API o envio do push (a API calcula os destinatários). */
  const requestPush = useCallback(
    async (messageId: string) => {
      try {
        await apiClient.notifyMessage(conversationId, messageId);
      } catch {
        setPushWarning(PUSH_WARNING_TEXT);
      }
    },
    [conversationId],
  );

  /** Envia uma mensagem. Retorna `false` se ela nem chegou a ser enviada (ex.: texto vazio). */
  const send = useCallback(
    (message: OutgoingMessage): boolean => {
      try {
        const { messageId, committed } = sendMessage({ conversationId, conversationType, senderId: userId, message });
        setFailedSend(null);
        // A mensagem aparece na hora (listener local); a confirmação do servidor pode demorar offline.
        committed
          .then(() => requestPush(messageId))
          .catch((sendError: unknown) => setFailedSend({ message, error: getErrorMessage(sendError) }));
        return true;
      } catch (sendError) {
        setFailedSend({ message, error: getErrorMessage(sendError) });
        return false;
      }
    },
    [conversationId, conversationType, userId, requestPush],
  );

  const retryFailedSend = useCallback(() => {
    if (failedSend) send(failedSend.message);
  }, [failedSend, send]);

  const dismissFailedSend = useCallback(() => setFailedSend(null), []);
  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  return { messages, status, error, failedSend, pushWarning, send, retryFailedSend, dismissFailedSend, retry };
}

/** `true` quando o app está conectado ao Realtime Database (considera conectado até saber o contrário). */
export function useConnectionStatus(): boolean {
  const [connected, setConnected] = useState(true);
  useEffect(() => subscribeConnection(setConnected), []);
  return connected;
}
