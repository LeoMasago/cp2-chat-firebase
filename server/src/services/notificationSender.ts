import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import type { Message, Messaging } from 'firebase-admin/messaging';
import type { DeviceRecord, PushContent, PushReport } from '../types.js';

/** Canal Android criado pelo app (`notificationService.ts`). */
export const ANDROID_CHANNEL_ID = 'messages';

/** Limite do `sendEach` do Admin SDK por chamada. */
const FCM_BATCH_SIZE = 500;

/** Códigos do FCM que indicam token definitivamente inválido (devem ser removidos). */
const INVALID_TOKEN_CODES: ReadonlySet<string> = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export interface PushSender {
  send(devices: readonly DeviceRecord[], content: PushContent): Promise<PushReport>;
}

export type FcmClient = Pick<Messaging, 'sendEach'>;
export type ExpoClient = Pick<Expo, 'chunkPushNotifications' | 'sendPushNotificationsAsync'>;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * Envia o push pelos dois caminhos suportados:
 *  - `fcm`  → Firebase Cloud Messaging via Firebase Admin SDK (Android);
 *  - `expo` → Expo Push Service, que entrega via APNs no iOS (token do `expo-notifications`).
 */
export function createPushSender(fcm: FcmClient, expo: ExpoClient): PushSender {
  async function sendViaFcm(devices: readonly DeviceRecord[], content: PushContent): Promise<PushReport> {
    const report: PushReport = { sent: 0, failed: 0, invalidDevices: [] };
    for (const batch of chunk(devices, FCM_BATCH_SIZE)) {
      const messages: Message[] = batch.map((device) => ({
        token: device.token,
        notification: { title: content.title, body: content.body },
        data: content.data,
        android: {
          priority: 'high',
          notification: { channelId: ANDROID_CHANNEL_ID },
        },
        apns: { payload: { aps: { sound: 'default' } } },
      }));
      try {
        const response = await fcm.sendEach(messages);
        response.responses.forEach((result, index) => {
          const device = batch[index];
          if (!device) return;
          if (result.success) {
            report.sent += 1;
            return;
          }
          report.failed += 1;
          if (result.error && INVALID_TOKEN_CODES.has(result.error.code)) {
            report.invalidDevices.push(device);
          }
        });
      } catch {
        report.failed += batch.length;
      }
    }
    return report;
  }

  async function sendViaExpo(devices: readonly DeviceRecord[], content: PushContent): Promise<PushReport> {
    const report: PushReport = { sent: 0, failed: 0, invalidDevices: [] };
    const valid: DeviceRecord[] = [];
    for (const device of devices) {
      if (Expo.isExpoPushToken(device.token)) valid.push(device);
      else {
        report.failed += 1;
        report.invalidDevices.push(device);
      }
    }

    // Os tickets voltam na mesma ordem das mensagens enviadas.
    const entries = valid.map((device): { device: DeviceRecord; message: ExpoPushMessage } => ({
      device,
      message: {
        to: device.token,
        title: content.title,
        body: content.body,
        data: content.data,
        sound: 'default',
        priority: 'high',
        channelId: ANDROID_CHANNEL_ID,
      },
    }));

    const messageChunks = expo.chunkPushNotifications(entries.map((entry) => entry.message));
    let offset = 0;
    for (const messages of messageChunks) {
      const owners = entries.slice(offset, offset + messages.length);
      offset += messages.length;
      try {
        const tickets = await expo.sendPushNotificationsAsync(messages);
        tickets.forEach((ticket, index) => {
          if (ticket.status === 'ok') {
            report.sent += 1;
            return;
          }
          report.failed += 1;
          const owner = owners[index];
          if (owner && ticket.details?.error === 'DeviceNotRegistered') {
            report.invalidDevices.push(owner.device);
          }
        });
      } catch {
        report.failed += messages.length;
      }
    }
    return report;
  }

  return {
    async send(devices, content) {
      const fcmDevices = devices.filter((device) => device.tokenType === 'fcm');
      const expoDevices = devices.filter((device) => device.tokenType === 'expo');
      const [viaFcm, viaExpo] = await Promise.all([
        sendViaFcm(fcmDevices, content),
        sendViaExpo(expoDevices, content),
      ]);
      return {
        sent: viaFcm.sent + viaExpo.sent,
        failed: viaFcm.failed + viaExpo.failed,
        invalidDevices: [...viaFcm.invalidDevices, ...viaExpo.invalidDevices],
      };
    },
  };
}
