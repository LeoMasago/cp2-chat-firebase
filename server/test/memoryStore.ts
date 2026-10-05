import type { ChatStore } from '../src/services/chatStore.js';
import type { PushSender } from '../src/services/notificationSender.js';
import type {
  DeviceRecord,
  DispatchResult,
  PrivateProfile,
  PublicProfile,
  PushContent,
  StoredDirectConversation,
  StoredGroup,
  StoredMessage,
} from '../src/types.js';

/** Implementação em memória de `ChatStore` para testar as rotas sem o Firebase. */
export class MemoryStore implements ChatStore {
  messages = new Map<string, StoredMessage>();
  groups = new Map<string, StoredGroup>();
  directs = new Map<string, StoredDirectConversation>();
  publicProfiles = new Map<string, PublicProfile>();
  privateProfiles = new Map<string, PrivateProfile>();
  devices: DeviceRecord[] = [];
  dispatches = new Map<string, { status: 'processing' | 'sent' | 'failed'; result?: DispatchResult }>();
  groupMembersMirror = new Map<string, string[]>();

  async getMessage(conversationId: string, messageId: string) {
    return this.messages.get(`${conversationId}/${messageId}`) ?? null;
  }
  async getGroup(groupId: string) {
    return this.groups.get(groupId) ?? null;
  }
  async listGroupsOfUser(uid: string) {
    return [...this.groups.values()].filter((group) => group.memberIds.includes(uid));
  }
  async getDirectConversation(conversationId: string) {
    return this.directs.get(conversationId) ?? null;
  }
  async getPublicProfile(uid: string) {
    return this.publicProfiles.get(uid) ?? null;
  }
  async getPrivateProfile(uid: string) {
    return this.privateProfiles.get(uid) ?? null;
  }
  async listEnabledDevices(uids: readonly string[]) {
    return this.devices.filter((device) => uids.includes(device.uid));
  }
  async removeDevices(devices: readonly DeviceRecord[]) {
    this.devices = this.devices.filter(
      (existing) => !devices.some((gone) => gone.uid === existing.uid && gone.deviceId === existing.deviceId),
    );
  }
  async releaseDeviceToken(uid: string, deviceId: string) {
    const own = this.devices.find((device) => device.uid === uid && device.deviceId === deviceId);
    if (!own) return 0;
    const before = this.devices.length;
    this.devices = this.devices.filter((device) => device.token !== own.token || device.uid === uid);
    return before - this.devices.length;
  }
  async claimDispatch(key: string) {
    const existing = this.dispatches.get(key);
    if (existing && (existing.status === 'sent' || existing.status === 'processing')) return 'duplicate' as const;
    this.dispatches.set(key, { status: 'processing' });
    return 'claimed' as const;
  }
  async completeDispatch(key: string, result: DispatchResult) {
    this.dispatches.set(key, { status: 'sent', result });
  }
  async failDispatch(key: string) {
    this.dispatches.set(key, { status: 'failed' });
  }
  async replaceGroupMembers(groupId: string, memberIds: readonly string[]) {
    this.groupMembersMirror.set(groupId, [...memberIds]);
  }
}

export type SentPush = { devices: DeviceRecord[]; content: PushContent };

/** `PushSender` que só registra o que seria enviado. */
export class RecordingPushSender implements PushSender {
  sent: SentPush[] = [];
  invalidTokens = new Set<string>();
  failAll = false;

  async send(devices: readonly DeviceRecord[], content: PushContent) {
    const invalidDevices = devices.filter((device) => this.invalidTokens.has(device.token));
    const deliverable = devices.filter((device) => !this.invalidTokens.has(device.token));
    if (this.failAll) return { sent: 0, failed: devices.length, invalidDevices: [] };
    this.sent.push({ devices: deliverable, content });
    return { sent: deliverable.length, failed: invalidDevices.length, invalidDevices };
  }
}
