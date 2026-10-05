import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  limitToLast,
  onValue,
  orderByChild,
  push,
  query as databaseQuery,
  ref,
  serverTimestamp,
  update,
  type DataSnapshot,
  type DatabaseReference,
  type Query,
} from 'firebase/database';
import type {
  ChatMessage,
  ConversationType,
  DirectConversation,
  LastMessage,
  OutgoingMessage,
} from '../types/chat';
import { getDirectConversationId, getDirectParticipants } from '../utils/conversationId';
import { AppError, isPermissionDenied } from '../utils/errors';
import { firestore, realtimeDb } from './firebase';
import { parseDirectConversation, parseLastMessage, parseMessage } from './parsers';

/** Quantidade de mensagens mantidas na janela em tempo real de cada conversa. */
const MESSAGE_WINDOW = 200;
/** Tentativas extras quando o Realtime Database ainda nega acesso (ver `listenWithRetry`). */
const LISTEN_RETRIES = 4;
const LISTEN_RETRY_DELAY_MS = 1_500;
const LAST_MESSAGE_PREVIEW_LENGTH = 200;

/**
 * `onValue` com nova tentativa quando o acesso é negado.
 *
 * Quando alguém entra em um grupo, o Firestore passa a mostrar o grupo imediatamente, mas o acesso
 * às mensagens no Realtime Database só existe depois que a API copia os integrantes para
 * `groupMembers/{groupId}` (alguns instantes). Um listener cancelado por "permission denied" não
 * volta sozinho, então reassinamos com espera crescente antes de reportar o erro.
 */
function listenWithRetry(
  createSource: () => DatabaseReference | Query,
  onSnapshot: (snapshot: DataSnapshot) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  let disposed = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let detach: (() => void) | null = null;

  const attach = () => {
    detach = onValue(
      createSource(),
      (snapshot) => {
        attempt = 0;
        onSnapshot(snapshot);
      },
      (error) => {
        detach = null; // um listener cancelado já foi removido pelo SDK
        if (disposed) return;
        if (isPermissionDenied(error) && attempt < LISTEN_RETRIES) {
          attempt += 1;
          timer = setTimeout(attach, LISTEN_RETRY_DELAY_MS * attempt);
          return;
        }
        onError(error);
      },
    );
  };
  attach();

  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    detach?.();
  };
}

/**
 * Cria (ou localiza) a conversa individual entre dois usuários.
 * O id é derivado dos dois `uid` ordenados, então nunca existem duas conversas para o mesmo par.
 */
export async function ensureDirectConversation(myUid: string, otherUid: string): Promise<DirectConversation> {
  const conversationId = getDirectConversationId(myUid, otherUid); // lança se for o mesmo usuário
  const participantIds = getDirectParticipants(myUid, otherUid);
  const conversationRef = doc(firestore, 'directConversations', conversationId);

  const existing = await getDoc(conversationRef);
  if (existing.exists()) {
    const parsed = parseDirectConversation(conversationId, existing.data());
    if (parsed) return parsed;
  }

  const createdAt = Date.now();
  try {
    await setDoc(conversationRef, { participantIds, createdAt });
  } catch (error) {
    // A outra pessoa pode ter criado a conversa no mesmo instante: lê de novo antes de falhar.
    if (!isPermissionDenied(error)) throw error;
    const retry = await getDoc(conversationRef);
    const parsed = retry.exists() ? parseDirectConversation(conversationId, retry.data()) : null;
    if (parsed) return parsed;
    throw error;
  }
  return { id: conversationId, type: 'direct', participantIds, createdAt };
}

/** Conversas individuais do usuário, em tempo real. */
export function subscribeDirectConversations(
  uid: string,
  onData: (conversations: DirectConversation[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const conversationsQuery = query(
    collection(firestore, 'directConversations'),
    where('participantIds', 'array-contains', uid),
  );
  return onSnapshot(
    conversationsQuery,
    (snapshot) => {
      const conversations = snapshot.docs
        .map((document) => parseDirectConversation(document.id, document.data()))
        .filter((conversation): conversation is DirectConversation => conversation !== null);
      onData(conversations);
    },
    onError,
  );
}

export type SendMessageParams = {
  conversationId: string;
  conversationType: ConversationType;
  senderId: string;
  message: OutgoingMessage;
};

export type SendMessageResult = {
  messageId: string;
  /** Resolve quando o Realtime Database confirma a gravação; rejeita se as regras recusarem. */
  committed: Promise<void>;
};

/**
 * Grava a mensagem no Realtime Database (`messages/{conversationId}/{messageId}`) e atualiza o
 * resumo da conversa (`conversationMeta/.../lastMessage`) na mesma escrita atômica.
 * O horário é definido pelo servidor, e as regras garantem `senderId == auth.uid`.
 */
export function sendMessage(params: SendMessageParams): SendMessageResult {
  const text = params.message.text.trim();
  if (!text) throw new AppError('chat/empty-message', 'Digite uma mensagem antes de enviar.');

  const messageRef = push(ref(realtimeDb, `messages/${params.conversationId}`));
  const messageId = messageRef.key;
  if (!messageId) throw new AppError('chat/conversation-unavailable', 'Não foi possível criar a mensagem.');

  const record: Record<string, unknown> = {
    conversationId: params.conversationId,
    conversationType: params.conversationType,
    senderId: params.senderId,
    text,
    target: params.message.target,
    createdAt: serverTimestamp(),
  };
  // O Realtime Database não armazena listas vazias; só enviamos quando há menções.
  if (params.message.mentionedUserIds.length > 0) record['mentionedUserIds'] = params.message.mentionedUserIds;

  const updates: Record<string, unknown> = {
    [`messages/${params.conversationId}/${messageId}`]: record,
    [`conversationMeta/${params.conversationId}/lastMessage`]: {
      text: text.slice(0, LAST_MESSAGE_PREVIEW_LENGTH),
      senderId: params.senderId,
      createdAt: serverTimestamp(),
    },
  };
  return { messageId, committed: update(ref(realtimeDb), updates) };
}

/**
 * Escuta as mensagens da conversa em tempo real. Retorne a função devolvida no cleanup do
 * `useEffect` para remover o listener ao fechar a tela ou trocar de conversa.
 */
export function subscribeMessages(
  conversationId: string,
  onData: (messages: ChatMessage[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const createQuery = () =>
    databaseQuery(ref(realtimeDb, `messages/${conversationId}`), orderByChild('createdAt'), limitToLast(MESSAGE_WINDOW));
  return listenWithRetry(
    createQuery,
    (snapshot) => {
      const messages: ChatMessage[] = [];
      snapshot.forEach((child) => {
        const message = parseMessage(conversationId, child.key ?? '', child.val());
        if (message) messages.push(message);
      });
      onData(messages);
    },
    onError,
  );
}

/** Última mensagem da conversa (para a lista de conversas). */
export function subscribeLastMessage(
  conversationId: string,
  onData: (message: LastMessage | null) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return listenWithRetry(
    () => ref(realtimeDb, `conversationMeta/${conversationId}/lastMessage`),
    (snapshot) => onData(snapshot.exists() ? parseLastMessage(snapshot.val()) : null),
    onError,
  );
}

/** Estado da conexão com o Realtime Database (`.info/connected`). */
export function subscribeConnection(onChange: (connected: boolean) => void): Unsubscribe {
  return onValue(ref(realtimeDb, '.info/connected'), (snapshot) => onChange(snapshot.val() === true));
}
