import { Timestamp, type DocumentData } from 'firebase-admin/firestore';
import {
  NOTIFICATION_POLICIES,
  type ConversationType,
  type DeviceRecord,
  type DispatchClaim,
  type DispatchResult,
  type MessageTarget,
  type NotificationPolicy,
  type PrivateProfile,
  type PublicProfile,
  type PushTokenType,
  type StoredDirectConversation,
  type StoredGroup,
  type StoredMessage,
} from '../types.js';
import type { AdminServices } from './firebaseAdmin.js';
import type { ChatStore } from './chatStore.js';

/** Um push "em processamento" por mais que isso é considerado travado e pode ser refeito. */
const PROCESSING_STALE_MS = 60_000;
/** Prazo gravado em `expiresAt`; apagar sozinho exige uma política de TTL do Firestore (plano Blaze, opcional). */
const DISPATCH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** O RTDB devolve arrays como objetos indexados quando há "buracos"; aceita ambos. */
const asStringList = (value: unknown): string[] => {
  const items = Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : [];
  return items.filter((item): item is string => typeof item === 'string');
};

const asPolicy = (value: unknown): NotificationPolicy | null =>
  NOTIFICATION_POLICIES.find((policy) => policy === value) ?? null;

const asConversationType = (value: unknown): ConversationType | null =>
  value === 'direct' || value === 'group' ? value : null;

function parseTarget(value: unknown): MessageTarget {
  if (isRecord(value) && value['type'] === 'member') {
    const memberId = asString(value['memberId']);
    if (memberId) return { type: 'member', memberId };
  }
  return { type: 'conversation' };
}

function parseMessage(conversationId: string, id: string, value: unknown): StoredMessage | null {
  if (!isRecord(value)) return null;
  const conversationType = asConversationType(value['conversationType']);
  const senderId = asString(value['senderId']);
  const text = asString(value['text']);
  if (!conversationType || !senderId || text === null) return null;
  return {
    id,
    conversationId: asString(value['conversationId']) ?? conversationId,
    conversationType,
    senderId,
    text,
    target: parseTarget(value['target']),
    mentionedUserIds: asStringList(value['mentionedUserIds']),
    createdAt: asNumber(value['createdAt']) ?? 0,
  };
}

function parseGroup(id: string, data: DocumentData | undefined): StoredGroup | null {
  if (!data) return null;
  const name = asString(data['name']);
  const ownerId = asString(data['ownerId']);
  const policy = asPolicy(data['notificationPolicy']);
  const memberLimit = asNumber(data['memberLimit']);
  if (!name || !ownerId || !policy || memberLimit === null) return null;
  return {
    id,
    name,
    photoUrl: asString(data['photoUrl']) ?? '',
    ownerId,
    memberIds: asStringList(data['memberIds']),
    memberLimit,
    notificationPolicy: policy,
  };
}

function parseDevice(uid: string, deviceId: string, data: DocumentData): DeviceRecord | null {
  const token = asString(data['token']);
  if (!token) return null;
  const declaredType = data['tokenType'];
  const tokenType: PushTokenType =
    declaredType === 'expo' || declaredType === 'fcm'
      ? declaredType
      : token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')
        ? 'expo'
        : 'fcm';
  return {
    uid,
    deviceId,
    token,
    tokenType,
    platform: data['platform'] === 'ios' ? 'ios' : 'android',
  };
}

export function createFirebaseStore({ firestore, database }: AdminServices): ChatStore {
  const users = firestore.collection('users');
  const dispatches = firestore.collection('notificationDispatches');

  return {
    async getMessage(conversationId, messageId) {
      const snapshot = await database.ref(`messages/${conversationId}/${messageId}`).get();
      return snapshot.exists() ? parseMessage(conversationId, messageId, snapshot.val()) : null;
    },

    async getGroup(groupId) {
      const snapshot = await firestore.collection('groups').doc(groupId).get();
      return snapshot.exists ? parseGroup(snapshot.id, snapshot.data()) : null;
    },

    async listGroupsOfUser(uid) {
      const snapshot = await firestore
        .collection('groups')
        .where('memberIds', 'array-contains', uid)
        .get();
      return snapshot.docs
        .map((doc) => parseGroup(doc.id, doc.data()))
        .filter((group): group is StoredGroup => group !== null);
    },

    async getDirectConversation(conversationId): Promise<StoredDirectConversation | null> {
      const snapshot = await firestore.collection('directConversations').doc(conversationId).get();
      if (!snapshot.exists) return null;
      return { id: snapshot.id, participantIds: asStringList(snapshot.data()?.['participantIds']) };
    },

    async getPublicProfile(uid): Promise<PublicProfile | null> {
      const snapshot = await users.doc(uid).get();
      const data = snapshot.data();
      if (!snapshot.exists || !data) return null;
      return {
        uid,
        name: asString(data['name']) ?? '',
        photoUrl: asString(data['photoUrl']) ?? '',
        createdAt: asNumber(data['createdAt']),
      };
    },

    async getPrivateProfile(uid): Promise<PrivateProfile | null> {
      const snapshot = await users.doc(uid).collection('private').doc('profile').get();
      const data = snapshot.data();
      if (!snapshot.exists || !data) return null;
      return {
        email: asString(data['email']),
        phoneNumber: asString(data['phoneNumber']),
        birthDate: asString(data['birthDate']),
      };
    },

    async listEnabledDevices(uids) {
      const perUser = await Promise.all(
        uids.map(async (uid) => {
          const snapshot = await users
            .doc(uid)
            .collection('devices')
            .where('enabled', '==', true)
            .get();
          return snapshot.docs
            .map((doc) => parseDevice(uid, doc.id, doc.data()))
            .filter((device): device is DeviceRecord => device !== null);
        }),
      );
      return perUser.flat();
    },

    async removeDevices(devices) {
      if (devices.length === 0) return;
      const batch = firestore.batch();
      for (const device of devices) {
        batch.delete(users.doc(device.uid).collection('devices').doc(device.deviceId));
      }
      await batch.commit();
    },

    async releaseDeviceToken(uid, deviceId) {
      const own = await users.doc(uid).collection('devices').doc(deviceId).get();
      const token = asString(own.data()?.['token']);
      if (!token) return 0;
      const sameToken = await firestore.collectionGroup('devices').where('token', '==', token).get();
      const stale = sameToken.docs.filter((doc) => doc.ref.parent.parent?.id !== uid);
      if (stale.length === 0) return 0;
      const batch = firestore.batch();
      for (const doc of stale) batch.delete(doc.ref);
      await batch.commit();
      return stale.length;
    },

    async claimDispatch(key, meta): Promise<DispatchClaim> {
      const ref = dispatches.doc(key);
      return firestore.runTransaction(async (transaction): Promise<DispatchClaim> => {
        const snapshot = await transaction.get(ref);
        const now = Date.now();
        const previous = snapshot.data();
        if (previous) {
          const status = previous['status'];
          const startedAt = asNumber(previous['startedAt']) ?? 0;
          const alreadyDone = status === 'sent';
          const inFlight = status === 'processing' && now - startedAt < PROCESSING_STALE_MS;
          if (alreadyDone || inFlight) return 'duplicate';
        }
        transaction.set(ref, {
          status: 'processing',
          senderId: meta.senderId,
          startedAt: now,
          attempts: (asNumber(previous?.['attempts']) ?? 0) + 1,
          expiresAt: Timestamp.fromMillis(now + DISPATCH_RETENTION_MS),
        });
        return 'claimed';
      });
    },

    async completeDispatch(key, result: DispatchResult) {
      await dispatches.doc(key).set(
        { status: 'sent', finishedAt: Date.now(), result },
        { merge: true },
      );
    },

    async failDispatch(key, reason) {
      await dispatches.doc(key).set(
        { status: 'failed', finishedAt: Date.now(), error: reason.slice(0, 300) },
        { merge: true },
      );
    },

    async replaceGroupMembers(groupId, memberIds) {
      const members: Record<string, true> = {};
      for (const uid of memberIds) members[uid] = true;
      await database.ref(`groupMembers/${groupId}`).set(members);
    },
  };
}
