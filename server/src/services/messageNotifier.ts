import { forbidden, HttpError, notFound } from '../errors.js';
import type {
  DispatchResult,
  PushContent,
  StoredDirectConversation,
  StoredGroup,
  StoredMessage,
} from '../types.js';
import type { ChatStore } from './chatStore.js';
import type { PushSender } from './notificationSender.js';
import { resolveRecipientIds, type RecipientInput } from './recipientResolver.js';

/** Mensagens mais antigas que isso não geram push (evita reaproveitar um `messageId` antigo). */
export const MAX_MESSAGE_AGE_MS = 15 * 60 * 1000;

const PREVIEW_MAX_LENGTH = 80;

export type NotifyStatus = 'sent' | 'duplicate' | 'expired' | 'no_recipients' | 'no_devices';

export type NotifyOutcome = { status: NotifyStatus } & DispatchResult;

export type NotifierOptions = {
  store: ChatStore;
  push: PushSender;
  /** Inclui um trecho do texto no corpo do push (`NOTIFICATION_PREVIEW`). */
  includePreview: boolean;
  now?: () => number;
};

const emptyResult: DispatchResult = { recipients: 0, devices: 0, sent: 0, failed: 0, removedTokens: 0 };

export const dispatchKey = (conversationId: string, messageId: string): string =>
  `${conversationId}__${messageId}`;

function buildPreview(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > PREVIEW_MAX_LENGTH ? `${compact.slice(0, PREVIEW_MAX_LENGTH - 1)}…` : compact;
}

function buildContent(
  message: StoredMessage,
  senderName: string,
  group: StoredGroup | null,
  includePreview: boolean,
): PushContent {
  const preview = includePreview ? buildPreview(message.text) : '';
  const body =
    message.conversationType === 'group'
      ? preview
        ? `${senderName}: ${preview}`
        : `${senderName} enviou uma mensagem.`
      : preview || 'Nova mensagem.';
  return {
    title: group ? group.name : senderName,
    body,
    // O payload leva só o necessário para abrir a conversa (README: conversationId + conversationType).
    data: {
      conversationId: message.conversationId,
      conversationType: message.conversationType,
      messageId: message.id,
      senderId: message.senderId,
    },
  };
}

/**
 * Fluxo de envio descrito no enunciado:
 *  1. confirma no Realtime Database que a mensagem existe e é do usuário autenticado;
 *  2. confirma no Firestore que a conversa existe e que o remetente participa dela;
 *  3. garante idempotência (a mesma mensagem não notifica duas vezes);
 *  4. calcula os destinatários pela política da conversa (nunca recebidos do app);
 *  5. busca os tokens dos dispositivos e envia pelo FCM / Expo Push Service;
 *  6. remove tokens recusados como inválidos.
 */
export async function notifyMessage(
  options: NotifierOptions,
  request: { uid: string; conversationId: string; messageId: string },
): Promise<NotifyOutcome> {
  const { store, push, includePreview } = options;
  const now = options.now ?? Date.now;
  const { uid, conversationId, messageId } = request;

  const message = await store.getMessage(conversationId, messageId);
  if (!message) throw notFound('Mensagem não encontrada.');
  if (message.senderId !== uid) throw forbidden('A mensagem não pertence ao usuário autenticado.');

  let group: StoredGroup | null = null;
  let direct: StoredDirectConversation | null = null;
  let recipientInput: RecipientInput;

  if (message.conversationType === 'group') {
    group = await store.getGroup(conversationId);
    if (!group) throw notFound('Grupo não encontrado.');
    if (!group.memberIds.includes(uid)) throw forbidden('Você não participa deste grupo.');
    recipientInput = {
      conversationType: 'group',
      senderId: uid,
      memberIds: group.memberIds,
      policy: group.notificationPolicy,
      target: message.target,
      mentionedUserIds: message.mentionedUserIds,
    };
  } else {
    direct = await store.getDirectConversation(conversationId);
    if (!direct) throw notFound('Conversa não encontrada.');
    if (!direct.participantIds.includes(uid)) throw forbidden('Você não participa desta conversa.');
    recipientInput = {
      conversationType: 'direct',
      senderId: uid,
      participantIds: direct.participantIds,
    };
  }

  if (now() - message.createdAt > MAX_MESSAGE_AGE_MS) {
    return { status: 'expired', ...emptyResult };
  }

  const key = dispatchKey(conversationId, messageId);
  const claim = await store.claimDispatch(key, { senderId: uid });
  if (claim === 'duplicate') return { status: 'duplicate', ...emptyResult };

  try {
    const recipientIds = resolveRecipientIds(recipientInput);
    if (recipientIds.length === 0) {
      await store.completeDispatch(key, emptyResult);
      return { status: 'no_recipients', ...emptyResult };
    }

    const devices = await store.listEnabledDevices(recipientIds);
    if (devices.length === 0) {
      const result: DispatchResult = { ...emptyResult, recipients: recipientIds.length };
      await store.completeDispatch(key, result);
      return { status: 'no_devices', ...result };
    }

    const sender = await store.getPublicProfile(uid);
    const content = buildContent(message, sender?.name || 'Alguém', group, includePreview);
    const report = await push.send(devices, content);
    await store.removeDevices(report.invalidDevices);

    // Nada foi entregue por falha transitória (rede, provedor): libera o reenvio em vez de
    // marcar a mensagem como processada.
    const transientFailures = report.failed - report.invalidDevices.length;
    if (report.sent === 0 && transientFailures > 0) {
      throw new HttpError(502, 'push_failed', 'O provedor de push não aceitou a notificação. Tente novamente.');
    }

    const result: DispatchResult = {
      recipients: recipientIds.length,
      devices: devices.length,
      sent: report.sent,
      failed: report.failed,
      removedTokens: report.invalidDevices.length,
    };
    await store.completeDispatch(key, result);
    return { status: 'sent', ...result };
  } catch (error) {
    // Libera o registro para que o app possa tentar novamente.
    await store.failDispatch(key, error instanceof Error ? error.message : 'erro desconhecido');
    throw error;
  }
}
