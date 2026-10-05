import { NOTIFICATION_POLICIES, type NotificationPolicy } from '../types/notification';
import type {
  ChatMessage,
  ConversationType,
  DirectConversation,
  LastMessage,
  MessageTarget,
} from '../types/chat';
import type { ChatGroup } from '../types/group';
import type { PrivateProfile, PublicProfile } from '../types/user';

/**
 * Conversão dos dados lidos do Firebase (tipo `unknown`) para os tipos do app.
 * Nada é aceito "no escuro": campos ausentes ou com tipo errado são descartados
 * ou recebem valores seguros, evitando `any` e crashes por dados inesperados.
 */

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

export const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** O Realtime Database devolve listas como arrays ou como objetos indexados. */
export function asStringList(value: unknown): string[] {
  const items = Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : [];
  return items.filter((item): item is string => typeof item === 'string');
}

export function asPolicy(value: unknown): NotificationPolicy {
  return NOTIFICATION_POLICIES.find((policy) => policy === value) ?? 'all_group_messages';
}

export function asConversationType(value: unknown): ConversationType {
  return value === 'group' ? 'group' : 'direct';
}

export function parsePublicProfile(uid: string, data: unknown): PublicProfile | null {
  if (!isRecord(data)) return null;
  return {
    uid,
    name: asString(data['name'], 'Usuário'),
    photoUrl: asString(data['photoUrl']),
    createdAt: asNumber(data['createdAt']),
  };
}

export function parsePrivateProfile(data: unknown): PrivateProfile | null {
  if (!isRecord(data)) return null;
  return {
    email: asString(data['email']),
    phoneNumber: asString(data['phoneNumber']),
    birthDate: asString(data['birthDate']),
  };
}

export function parseGroup(id: string, data: unknown): ChatGroup | null {
  if (!isRecord(data)) return null;
  return {
    id,
    name: asString(data['name'], 'Grupo'),
    photoUrl: asString(data['photoUrl']),
    ownerId: asString(data['ownerId']),
    memberIds: asStringList(data['memberIds']),
    memberLimit: asNumber(data['memberLimit'], 2),
    notificationPolicy: asPolicy(data['notificationPolicy']),
    createdAt: asNumber(data['createdAt']),
    updatedAt: asNumber(data['updatedAt']),
  };
}

export function parseDirectConversation(id: string, data: unknown): DirectConversation | null {
  if (!isRecord(data)) return null;
  const [first, second] = asStringList(data['participantIds']);
  if (!first || !second) return null;
  return { id, type: 'direct', participantIds: [first, second], createdAt: asNumber(data['createdAt']) };
}

export function parseTarget(value: unknown): MessageTarget {
  if (isRecord(value) && value['type'] === 'member') {
    const memberId = asString(value['memberId']);
    if (memberId) return { type: 'member', memberId };
  }
  return { type: 'conversation' };
}

export function parseMessage(conversationId: string, id: string, data: unknown): ChatMessage | null {
  if (!isRecord(data)) return null;
  const senderId = asString(data['senderId']);
  if (!senderId || typeof data['text'] !== 'string') return null;
  return {
    id,
    conversationId: asString(data['conversationId'], conversationId),
    conversationType: asConversationType(data['conversationType']),
    senderId,
    text: data['text'],
    target: parseTarget(data['target']),
    mentionedUserIds: asStringList(data['mentionedUserIds']),
    createdAt: asNumber(data['createdAt']),
  };
}

export function parseLastMessage(data: unknown): LastMessage | null {
  if (!isRecord(data)) return null;
  const senderId = asString(data['senderId']);
  if (!senderId) return null;
  return { text: asString(data['text']), senderId, createdAt: asNumber(data['createdAt']) };
}
