import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DeviceRecord, NotificationPolicy, StoredGroup, StoredMessage } from '../src/types.js';
import { MemoryStore, RecordingPushSender } from './memoryStore.js';

let server: Server;
let baseUrl: string;
let store: MemoryStore;
let push: RecordingPushSender;

const now = Date.now();

function device(uid: string, token = `fcm-${uid}`, tokenType: DeviceRecord['tokenType'] = 'fcm'): DeviceRecord {
  return { uid, deviceId: `device-${uid}`, token, tokenType, platform: 'android' };
}

function seedGroup(policy: NotificationPolicy, overrides: Partial<StoredGroup> = {}): StoredGroup {
  const group: StoredGroup = {
    id: 'g1',
    name: 'Turma 3SI',
    photoUrl: '',
    ownerId: 'ana',
    memberIds: ['ana', 'bia', 'caio'],
    memberLimit: 5,
    notificationPolicy: policy,
    ...overrides,
  };
  store.groups.set(group.id, group);
  return group;
}

function seedMessage(overrides: Partial<StoredMessage> = {}): StoredMessage {
  const message: StoredMessage = {
    id: 'm1',
    conversationId: 'g1',
    conversationType: 'group',
    senderId: 'ana',
    text: 'Olá, pessoal!',
    target: { type: 'conversation' },
    mentionedUserIds: [],
    createdAt: now,
    ...overrides,
  };
  store.messages.set(`${message.conversationId}/${message.id}`, message);
  return message;
}

async function call(path: string, options: { uid?: string; method?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.uid) headers['authorization'] = `Bearer token-${options.uid}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'POST',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

const notify = (uid: string | undefined, conversationId = 'g1', messageId = 'm1') =>
  call('/notifications/messages', { uid, body: { conversationId, messageId } });

beforeEach(async () => {
  store = new MemoryStore();
  push = new RecordingPushSender();
  store.publicProfiles.set('ana', { uid: 'ana', name: 'Ana', photoUrl: '', createdAt: 1 });
  const app = createApp({
    auth: {
      verifyIdToken: async (token) => {
        if (!token.startsWith('token-')) throw new Error('invalid');
        return { uid: token.slice('token-'.length) };
      },
    },
    store,
    push,
    includePreview: true,
    trustProxy: 0,
    version: 'test',
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('GET /health', () => {
  it('responde sem autenticação', async () => {
    const { status, json } = await call('/health', { method: 'GET' });
    expect(status).toBe(200);
    expect(json['status']).toBe('ok');
  });
});

describe('POST /notifications/messages — autenticação e autorização', () => {
  it('rejeita requisição sem token', async () => {
    seedGroup('all_group_messages');
    seedMessage();
    expect((await notify(undefined)).status).toBe(401);
  });

  it('rejeita token inválido', async () => {
    const response = await fetch(`${baseUrl}/notifications/messages`, {
      method: 'POST',
      headers: { authorization: 'Bearer lixo', 'content-type': 'application/json' },
      body: JSON.stringify({ conversationId: 'g1', messageId: 'm1' }),
    });
    expect(response.status).toBe(401);
  });

  it('rejeita identificadores com caracteres de caminho', async () => {
    const { status } = await notify('ana', 'g1/../x', 'm1');
    expect(status).toBe(400);
  });

  it('retorna 404 para mensagem inexistente', async () => {
    seedGroup('all_group_messages');
    expect((await notify('ana')).status).toBe(404);
  });

  it('não permite pedir push de mensagem de outro usuário', async () => {
    seedGroup('all_group_messages');
    seedMessage({ senderId: 'bia' });
    expect((await notify('ana')).status).toBe(403);
    expect(push.sent).toHaveLength(0);
  });

  it('não permite push de remetente removido do grupo', async () => {
    seedGroup('all_group_messages', { memberIds: ['ana', 'caio'] });
    seedMessage({ senderId: 'bia' });
    store.devices.push(device('ana'), device('caio'));
    expect((await notify('bia')).status).toBe(403);
    expect(push.sent).toHaveLength(0);
  });
});

describe('POST /notifications/messages — políticas de notificação', () => {
  beforeEach(() => {
    store.devices.push(device('ana'), device('bia'), device('caio'));
  });

  it('all_group_messages: notifica todos menos o remetente', async () => {
    seedGroup('all_group_messages');
    seedMessage();
    const { status, json } = await notify('ana');
    expect(status).toBe(200);
    expect(json['status']).toBe('sent');
    expect(push.sent).toHaveLength(1);
    expect(push.sent[0]?.devices.map((d) => d.uid).sort()).toEqual(['bia', 'caio']);
  });

  it('inclui conversationId e conversationType no payload', async () => {
    seedGroup('all_group_messages');
    seedMessage();
    await notify('ana');
    expect(push.sent[0]?.content.data).toMatchObject({ conversationId: 'g1', conversationType: 'group' });
    expect(push.sent[0]?.content.title).toBe('Turma 3SI');
    expect(push.sent[0]?.content.body).toBe('Ana: Olá, pessoal!');
  });

  it('mentioned_members: só o integrante selecionado recebe', async () => {
    seedGroup('mentioned_members');
    seedMessage({ target: { type: 'member', memberId: 'caio' } });
    await notify('ana');
    expect(push.sent[0]?.devices.map((d) => d.uid)).toEqual(['caio']);
  });

  it('mentioned_members: mensagem geral sem menções não envia push', async () => {
    seedGroup('mentioned_members');
    seedMessage();
    const { json } = await notify('ana');
    expect(json['status']).toBe('no_recipients');
    expect(push.sent).toHaveLength(0);
  });

  it.each<NotificationPolicy>(['direct_messages_only', 'disabled'])('%s: grupos não geram push', async (policy) => {
    seedGroup(policy);
    seedMessage({ target: { type: 'member', memberId: 'bia' }, mentionedUserIds: ['bia'] });
    const { json } = await notify('ana');
    expect(json['status']).toBe('no_recipients');
    expect(push.sent).toHaveLength(0);
  });

  it('conversa individual notifica o outro participante', async () => {
    store.directs.set('ana_bia', { id: 'ana_bia', participantIds: ['ana', 'bia'] });
    seedMessage({ id: 'd1', conversationId: 'ana_bia', conversationType: 'direct' });
    const { json } = await notify('ana', 'ana_bia', 'd1');
    expect(json['status']).toBe('sent');
    expect(push.sent[0]?.devices.map((d) => d.uid)).toEqual(['bia']);
    expect(push.sent[0]?.content.title).toBe('Ana');
  });

  it('omite o texto quando a prévia está desligada', async () => {
    seedGroup('all_group_messages');
    seedMessage({ text: 'segredo' });
    const app = createApp({
      auth: { verifyIdToken: async () => ({ uid: 'ana' }) },
      store,
      push,
      includePreview: false,
      trustProxy: 0,
      version: 'test',
    });
    const quiet = await new Promise<Server>((resolve) => {
      const instance = app.listen(0, () => resolve(instance));
    });
    const port = (quiet.address() as AddressInfo).port;
    await fetch(`http://127.0.0.1:${port}/notifications/messages`, {
      method: 'POST',
      headers: { authorization: 'Bearer x', 'content-type': 'application/json' },
      body: JSON.stringify({ conversationId: 'g1', messageId: 'm1' }),
    });
    await new Promise<void>((resolve) => quiet.close(() => resolve()));
    expect(push.sent[0]?.content.body).not.toContain('segredo');
  });
});

describe('POST /notifications/messages — idempotência e tokens', () => {
  beforeEach(() => {
    seedGroup('all_group_messages');
    seedMessage();
    store.devices.push(device('bia'), device('caio'));
  });

  it('reenvio da mesma mensagem não duplica o push', async () => {
    const first = await notify('ana');
    const second = await notify('ana');
    const [third, fourth] = await Promise.all([notify('ana'), notify('ana')]);
    expect(first.json['status']).toBe('sent');
    expect(second.json['status']).toBe('duplicate');
    expect(third.json['status']).toBe('duplicate');
    expect(fourth.json['status']).toBe('duplicate');
    expect(push.sent).toHaveLength(1);
  });

  it('remove tokens recusados como inválidos', async () => {
    push.invalidTokens.add('fcm-caio');
    const { json } = await notify('ana');
    expect(json['removedTokens']).toBe(1);
    expect(store.devices.map((d) => d.uid)).toEqual(['bia']);
  });

  it('permite nova tentativa quando o provedor falha por completo', async () => {
    push.failAll = true;
    expect((await notify('ana')).status).toBe(502);
    push.failAll = false;
    const retry = await notify('ana');
    expect(retry.status).toBe(200);
    expect(retry.json['status']).toBe('sent');
  });

  it('não envia push para mensagens antigas', async () => {
    seedMessage({ id: 'old', createdAt: now - 60 * 60 * 1000 });
    const { json } = await notify('ana', 'g1', 'old');
    expect(json['status']).toBe('expired');
    expect(push.sent).toHaveLength(0);
  });

  it('não envia push a quem desativou as notificações (sem dispositivo habilitado)', async () => {
    store.devices = [];
    const { json } = await notify('ana');
    expect(json['status']).toBe('no_devices');
  });
});

describe('GET /users/:uid/profile', () => {
  beforeEach(() => {
    store.publicProfiles.set('bia', { uid: 'bia', name: 'Bia', photoUrl: 'https://img/bia.jpg', createdAt: 2 });
    store.privateProfiles.set('bia', { email: 'bia@x.com', phoneNumber: '11999990000', birthDate: '2000-05-10' });
  });

  it('nega acesso a quem não compartilha conversa nem grupo', async () => {
    expect((await call('/users/bia/profile', { uid: 'ana', method: 'GET' })).status).toBe(403);
  });

  it('libera para quem compartilha uma conversa individual', async () => {
    store.directs.set('ana_bia', { id: 'ana_bia', participantIds: ['ana', 'bia'] });
    const { status, json } = await call('/users/bia/profile', { uid: 'ana', method: 'GET' });
    expect(status).toBe(200);
    expect(json).toMatchObject({ name: 'Bia', email: 'bia@x.com', phoneNumber: '11999990000' });
  });

  it('libera para quem compartilha um grupo', async () => {
    seedGroup('disabled');
    expect((await call('/users/bia/profile', { uid: 'caio', method: 'GET' })).status).toBe(200);
  });

  it('o próprio usuário sempre acessa e campos ausentes viram null', async () => {
    store.publicProfiles.set('ana', { uid: 'ana', name: 'Ana', photoUrl: '', createdAt: 1 });
    const { status, json } = await call('/users/ana/profile', { uid: 'ana', method: 'GET' });
    expect(status).toBe(200);
    expect(json['email']).toBeNull();
  });
});

describe('POST /groups/:groupId/sync-members', () => {
  it('copia os integrantes do Firestore para o espelho do RTDB', async () => {
    seedGroup('disabled');
    const { status } = await call('/groups/g1/sync-members', { uid: 'ana' });
    expect(status).toBe(200);
    expect(store.groupMembersMirror.get('g1')).toEqual(['ana', 'bia', 'caio']);
  });

  it('só o proprietário pode sincronizar', async () => {
    seedGroup('disabled');
    expect((await call('/groups/g1/sync-members', { uid: 'bia' })).status).toBe(403);
    expect(store.groupMembersMirror.has('g1')).toBe(false);
  });

  it('recusa grupo acima do limite', async () => {
    seedGroup('disabled', { memberLimit: 2 });
    expect((await call('/groups/g1/sync-members', { uid: 'ana' })).status).toBe(403);
  });

  it('retorna 404 para grupo inexistente', async () => {
    expect((await call('/groups/nada/sync-members', { uid: 'ana' })).status).toBe(404);
  });
});

describe('POST /devices/claim', () => {
  it('remove o mesmo token de outros usuários', async () => {
    store.devices.push(device('ana', 'tok-compartilhado'), device('bia', 'tok-compartilhado'), device('caio', 'tok-caio'));
    const { status, json } = await call('/devices/claim', { uid: 'bia', body: { deviceId: 'device-bia' } });
    expect(status).toBe(200);
    expect(json['released']).toBe(1);
    expect(store.devices.map((d) => d.uid).sort()).toEqual(['bia', 'caio']);
  });
});
