import type {
  DeviceRecord,
  DispatchClaim,
  DispatchResult,
  PrivateProfile,
  PublicProfile,
  StoredDirectConversation,
  StoredGroup,
  StoredMessage,
} from '../types.js';

/**
 * Porta de acesso aos dados do Firebase usada pelas rotas.
 *
 * A implementação real (`firebaseStore.ts`) usa o Admin SDK; os testes usam
 * uma implementação em memória. Assim a lógica de autorização e de
 * idempotência fica isolada e verificável.
 */
export interface ChatStore {
  /** Realtime Database: `messages/{conversationId}/{messageId}`. */
  getMessage(conversationId: string, messageId: string): Promise<StoredMessage | null>;

  /** Firestore: `groups/{groupId}`. */
  getGroup(groupId: string): Promise<StoredGroup | null>;
  listGroupsOfUser(uid: string): Promise<StoredGroup[]>;

  /** Firestore: `directConversations/{conversationId}`. */
  getDirectConversation(conversationId: string): Promise<StoredDirectConversation | null>;

  /** Firestore: `users/{uid}` e `users/{uid}/private/profile`. */
  getPublicProfile(uid: string): Promise<PublicProfile | null>;
  getPrivateProfile(uid: string): Promise<PrivateProfile | null>;

  /** Firestore: `users/{uid}/devices/*` com `enabled == true`. */
  listEnabledDevices(uids: readonly string[]): Promise<DeviceRecord[]>;
  /** Remove dispositivos cujo token foi recusado pelo FCM/Expo (inválido ou expirado). */
  removeDevices(devices: readonly DeviceRecord[]): Promise<void>;
  /**
   * Garante que o token do dispositivo pertença apenas a `uid`: apaga o mesmo
   * token registrado por outros usuários (ex.: logout sem conexão no mesmo
   * aparelho). Retorna quantos registros foram removidos.
   */
  releaseDeviceToken(uid: string, deviceId: string): Promise<number>;

  /**
   * Idempotência do push: registra de forma atômica que a mensagem está sendo
   * (ou já foi) processada. Reenvios devolvem `duplicate`.
   */
  claimDispatch(key: string, meta: { senderId: string }): Promise<DispatchClaim>;
  completeDispatch(key: string, result: DispatchResult): Promise<void>;
  failDispatch(key: string, reason: string): Promise<void>;

  /**
   * Espelha os integrantes do grupo (Firestore) no Realtime Database em
   * `groupMembers/{groupId}`, de onde as regras do RTDB lêem a permissão.
   */
  replaceGroupMembers(groupId: string, memberIds: readonly string[]): Promise<void>;
}
