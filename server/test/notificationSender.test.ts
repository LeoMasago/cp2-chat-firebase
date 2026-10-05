import type { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import type { BatchResponse, Message } from 'firebase-admin/messaging';
import { describe, expect, it } from 'vitest';
import {
  ANDROID_CHANNEL_ID,
  createPushSender,
  type ExpoClient,
  type FcmClient,
} from '../src/services/notificationSender.js';
import type { DeviceRecord, PushContent } from '../src/types.js';

const content: PushContent = {
  title: 'Turma 3SI',
  body: 'Ana: Olá!',
  data: { conversationId: 'g1', conversationType: 'group', messageId: 'm1', senderId: 'ana' },
};

const fcmDevice = (uid: string, token = `fcm-${uid}`): DeviceRecord => ({
  uid,
  deviceId: `d-${uid}`,
  token,
  tokenType: 'fcm',
  platform: 'android',
});

const expoDevice = (uid: string, token = `ExponentPushToken[${uid}]`): DeviceRecord => ({
  uid,
  deviceId: `d-${uid}`,
  token,
  tokenType: 'expo',
  platform: 'ios',
});

/** FCM falso: o `behavior` decide o resultado de cada token. */
function fakeFcm(behavior: (token: string) => { success: true } | { success: false; code: string } | 'throw') {
  const sent: Message[] = [];
  const client: FcmClient = {
    async sendEach(messages: Message[]): Promise<BatchResponse> {
      sent.push(...messages);
      const responses = messages.map((message) => {
        const outcome = behavior('token' in message ? message.token : '');
        if (outcome === 'throw') throw new Error('rede indisponível');
        return outcome.success
          ? { success: true, messageId: 'id' }
          : { success: false, error: { code: outcome.code, message: 'erro', toJSON: () => ({}) } };
      }) as unknown as BatchResponse['responses'];
      return {
        responses,
        successCount: responses.filter((r) => r.success).length,
        failureCount: responses.filter((r) => !r.success).length,
      };
    },
  };
  return { client, sent };
}

function fakeExpo(ticketFor: (message: ExpoPushMessage) => ExpoPushTicket | 'throw') {
  const sent: ExpoPushMessage[] = [];
  const client: ExpoClient = {
    chunkPushNotifications: (messages) => [messages],
    async sendPushNotificationsAsync(messages) {
      sent.push(...messages);
      return messages.map((message) => {
        const ticket = ticketFor(message);
        if (ticket === 'throw') throw new Error('Expo fora do ar');
        return ticket;
      });
    },
  };
  return { client, sent };
}

describe('createPushSender — FCM (Android)', () => {
  it('envia notification + data (conversationId/conversationType) com o canal Android', async () => {
    const fcm = fakeFcm(() => ({ success: true }));
    const sender = createPushSender(fcm.client, fakeExpo(() => ({ status: 'ok', id: 'x' })).client);
    const report = await sender.send([fcmDevice('bia')], content);

    expect(report).toEqual({ sent: 1, failed: 0, invalidDevices: [] });
    expect(fcm.sent[0]).toMatchObject({
      token: 'fcm-bia',
      notification: { title: 'Turma 3SI', body: 'Ana: Olá!' },
      data: { conversationId: 'g1', conversationType: 'group' },
      android: { priority: 'high', notification: { channelId: ANDROID_CHANNEL_ID } },
    });
  });

  it('marca como inválidos apenas os tokens que o FCM diz que não existem mais', async () => {
    const fcm = fakeFcm((token) => {
      if (token === 'fcm-velho') return { success: false, code: 'messaging/registration-token-not-registered' };
      if (token === 'fcm-quebrado') return { success: false, code: 'messaging/invalid-registration-token' };
      if (token === 'fcm-cota') return { success: false, code: 'messaging/quota-exceeded' };
      return { success: true };
    });
    const sender = createPushSender(fcm.client, fakeExpo(() => ({ status: 'ok', id: 'x' })).client);
    const devices = [fcmDevice('a', 'fcm-velho'), fcmDevice('b', 'fcm-quebrado'), fcmDevice('c', 'fcm-cota'), fcmDevice('d')];
    const report = await sender.send(devices, content);

    expect(report.sent).toBe(1);
    expect(report.failed).toBe(3);
    expect(report.invalidDevices.map((device) => device.uid).sort()).toEqual(['a', 'b']);
  });

  it('falha de rede no provedor conta como falha transitória (nenhum token é removido)', async () => {
    const sender = createPushSender(fakeFcm(() => 'throw').client, fakeExpo(() => ({ status: 'ok', id: 'x' })).client);
    const report = await sender.send([fcmDevice('a'), fcmDevice('b')], content);
    expect(report).toEqual({ sent: 0, failed: 2, invalidDevices: [] });
  });
});

describe('createPushSender — Expo Push Service (iOS)', () => {
  it('envia pelo Expo com os dados da conversa e canal', async () => {
    const expo = fakeExpo(() => ({ status: 'ok', id: 'ticket' }));
    const sender = createPushSender(fakeFcm(() => ({ success: true })).client, expo.client);
    const report = await sender.send([expoDevice('bia')], content);

    expect(report).toEqual({ sent: 1, failed: 0, invalidDevices: [] });
    expect(expo.sent[0]).toMatchObject({
      to: 'ExponentPushToken[bia]',
      title: 'Turma 3SI',
      body: 'Ana: Olá!',
      data: { conversationId: 'g1', conversationType: 'group' },
    });
  });

  it('remove tokens com DeviceNotRegistered e tokens com formato inválido', async () => {
    const expo = fakeExpo((message) =>
      message.to === 'ExponentPushToken[velho]'
        ? { status: 'error', message: 'não registrado', details: { error: 'DeviceNotRegistered' } }
        : { status: 'ok', id: 'ok' },
    );
    const sender = createPushSender(fakeFcm(() => ({ success: true })).client, expo.client);
    const report = await sender.send(
      [expoDevice('velho', 'ExponentPushToken[velho]'), expoDevice('bom'), expoDevice('lixo', 'nao-e-token')],
      content,
    );

    expect(report.sent).toBe(1);
    expect(report.invalidDevices.map((device) => device.uid).sort()).toEqual(['lixo', 'velho']);
    expect(expo.sent.map((message) => message.to)).not.toContain('nao-e-token');
  });

  it('erros de provedor (MessageRateExceeded) não removem o token', async () => {
    const expo = fakeExpo(() => ({ status: 'error', message: 'limite', details: { error: 'MessageRateExceeded' } }));
    const sender = createPushSender(fakeFcm(() => ({ success: true })).client, expo.client);
    const report = await sender.send([expoDevice('a')], content);
    expect(report).toEqual({ sent: 0, failed: 1, invalidDevices: [] });
  });

  it('queda do serviço conta como falha transitória', async () => {
    const sender = createPushSender(fakeFcm(() => ({ success: true })).client, fakeExpo(() => 'throw').client);
    expect(await sender.send([expoDevice('a')], content)).toEqual({ sent: 0, failed: 1, invalidDevices: [] });
  });
});

describe('createPushSender — mistura de plataformas', () => {
  it('roteia cada dispositivo pelo seu tipo de token e soma os resultados', async () => {
    const fcm = fakeFcm(() => ({ success: true }));
    const expo = fakeExpo(() => ({ status: 'ok', id: 'x' }));
    const sender = createPushSender(fcm.client, expo.client);
    const report = await sender.send([fcmDevice('android1'), expoDevice('ios1'), fcmDevice('android2')], content);

    expect(report).toEqual({ sent: 3, failed: 0, invalidDevices: [] });
    expect(fcm.sent).toHaveLength(2);
    expect(expo.sent).toHaveLength(1);
  });

  it('sem dispositivos, nada é enviado', async () => {
    const fcm = fakeFcm(() => ({ success: true }));
    const expo = fakeExpo(() => ({ status: 'ok', id: 'x' }));
    expect(await createPushSender(fcm.client, expo.client).send([], content)).toEqual({ sent: 0, failed: 0, invalidDevices: [] });
    expect(fcm.sent).toHaveLength(0);
    expect(expo.sent).toHaveLength(0);
  });
});
