/**
 * Tipos compartilhados da API. Espelham o modelo de dados do app
 * (`src/types/*`), que é a fonte de verdade do contrato com o Firebase.
 */

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

export type ConversationType = 'direct' | 'group';

export type MessageTarget =
  | { type: 'conversation' }
  | { type: 'member'; memberId: string };

/** Mensagem como lida do Realtime Database (`messages/{conversationId}/{messageId}`). */
export type StoredMessage = {
  id: string;
  conversationId: string;
  conversationType: ConversationType;
  senderId: string;
  text: string;
  target: MessageTarget;
  mentionedUserIds: string[];
  createdAt: number;
};

/** Documento `groups/{groupId}` do Firestore. */
export type StoredGroup = {
  id: string;
  name: string;
  photoUrl: string;
  ownerId: string;
  memberIds: string[];
  memberLimit: number;
  notificationPolicy: NotificationPolicy;
};

/** Documento `directConversations/{conversationId}` do Firestore. */
export type StoredDirectConversation = {
  id: string;
  participantIds: string[];
};

export type PushTokenType = 'fcm' | 'expo';

/** Documento `users/{uid}/devices/{deviceId}` do Firestore. */
export type DeviceRecord = {
  uid: string;
  deviceId: string;
  token: string;
  tokenType: PushTokenType;
  platform: 'android' | 'ios';
};

export type PublicProfile = {
  uid: string;
  name: string;
  photoUrl: string;
  createdAt: number | null;
};

export type PrivateProfile = {
  email: string | null;
  phoneNumber: string | null;
  birthDate: string | null;
};

export type ProfileView = PublicProfile & PrivateProfile;

export type PushContent = {
  title: string;
  body: string;
  /** Sempre strings: exigência do FCM para o campo `data`. */
  data: Record<string, string>;
};

export type PushReport = {
  sent: number;
  failed: number;
  /** Dispositivos cujo token foi recusado como inválido/expirado. */
  invalidDevices: DeviceRecord[];
};

export type DispatchClaim = 'claimed' | 'duplicate';

export type DispatchResult = {
  recipients: number;
  devices: number;
  sent: number;
  failed: number;
  removedTokens: number;
};
