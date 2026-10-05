import type { ConversationType } from './chat';

export type NotificationPolicy =
  | 'all_group_messages'
  | 'mentioned_members'
  | 'direct_messages_only'
  | 'disabled';

export const NOTIFICATION_POLICIES: readonly NotificationPolicy[] = [
  'all_group_messages',
  'mentioned_members',
  'direct_messages_only',
  'disabled',
];

export const NOTIFICATION_POLICY_LABELS: Record<NotificationPolicy, { title: string; description: string }> = {
  all_group_messages: {
    title: 'Todas as mensagens do grupo',
    description: 'Todos os integrantes (menos quem enviou) recebem push a cada mensagem do grupo.',
  },
  mentioned_members: {
    title: 'Somente mencionados',
    description: 'Só quem foi selecionado como destinatário ou mencionado com @ recebe o push.',
  },
  direct_messages_only: {
    title: 'Somente conversas individuais',
    description: 'Mensagens deste grupo não geram push; só conversas individuais notificam.',
  },
  disabled: {
    title: 'Desativadas',
    description: 'Nenhuma mensagem deste grupo gera notificação push.',
  },
};

/** Configuração de notificações de uma conversa (resolvida pela API a partir do grupo). */
export type NotificationSettings = {
  conversationId: string;
  policy: NotificationPolicy;
  updatedBy: string;
  updatedAt: number;
};

/** `fcm` = token nativo do Firebase Cloud Messaging; `expo` = token do Expo Push Service. */
export type PushTokenType = 'fcm' | 'expo';

export type DevicePlatform = 'android' | 'ios';

/** Documento `users/{uid}/devices/{deviceId}` no Firestore. */
export type DeviceRegistration = {
  token: string;
  tokenType: PushTokenType;
  platform: DevicePlatform;
  enabled: boolean;
  updatedAt: number;
};

/** Dados enviados no payload do push (README: no mínimo conversationId e conversationType). */
export type NotificationData = {
  conversationId: string;
  conversationType: ConversationType;
};

/** Resultado do registro do dispositivo, para a interface tratar cada situação. */
export type PushRegistrationResult =
  | { status: 'registered'; tokenType: PushTokenType }
  | { status: 'denied' }
  | { status: 'unsupported'; reason: string }
  | { status: 'no_token'; reason: string }
  | { status: 'error'; message: string };
