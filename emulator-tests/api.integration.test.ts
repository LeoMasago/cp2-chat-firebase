/**
 * Integração da API com o Firebase Emulator (Auth + Firestore + Realtime Database):
 *  - tokens reais do Firebase Authentication validados pelo Admin SDK;
 *  - `firebaseStore` real (transações do Firestore, espelho `groupMembers` no RTDB);
 *  - as REGRAS do RTDB liberando/bloqueando o acesso depois que a API sincroniza os integrantes.
 * Só o envio ao FCM/Expo é simulado (não há emulador de push).
 */
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { get, ref, serverTimestamp, set } from 'firebase/database';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../server/src/app.js';
import { adminServices, initEmulatorApp, type AdminServices } from '../server/src/services/firebaseAdmin.js';
import { createFirebaseStore } from '../server/src/services/firebaseStore.js';
import type { PushSender } from '../server/src/services/notificationSender.js';
import type { DeviceRecord, PushContent } from '../server/src/types.js';

const PROJECT_ID = 'demo-cp2';
// O cliente do rules-unit-testing usa o namespace = projectId; o Admin SDK precisa apontar para o mesmo.
const DATABASE_NS = PROJECT_ID;
const root = (file: string): string => fileURLToPath(new URL(`../${file}`, import.meta.url));

type TestUser = { uid: string; token: string; name: string };

async function signUp(email: string, name: string): Promise<TestUser> {
  const host = process.env['FIREBASE_AUTH_EMULATOR_HOST'] ?? '127.0.0.1:9099';
  const response = await fetch(`http://${host}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'senha123', returnSecureToken: true }),
  });
  const body = (await response.json()) as { localId: string; idToken: string };
  return { uid: body.localId, token: body.idToken, name };
}

class RecordingPush implements PushSender {
  sent: Array<{ devices: DeviceRecord[]; content: PushContent }> = [];
  async send(devices: readonly DeviceRecord[], content: PushContent) {
    this.sent.push({ devices: [...devices], content });
    return { sent: devices.length, failed: 0, invalidDevices: [] };
  }
}

let services: AdminServices;
let env: RulesTestEnvironment;
let server: Server;
let baseUrl: string;
const push = new RecordingPush();
let alice: TestUser;
let bob: TestUser;
let carol: TestUser;
let dave: TestUser;
const GROUP_ID = 'grpIntegracao0000001';

async function api(path: string, user: TestUser | null, body?: unknown, method = 'POST') {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(user ? { authorization: `Bearer ${user.token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

const notify = (user: TestUser | null, messageId: string) =>
  api('/notifications/messages', user, { conversationId: GROUP_ID, messageId });

beforeAll(async () => {
  [alice, bob, carol, dave] = await Promise.all([
    signUp('alice@exemplo.com', 'Alice'),
    signUp('bob@exemplo.com', 'Bob'),
    signUp('carol@exemplo.com', 'Carol'),
    signUp('dave@exemplo.com', 'Dave'),
  ]);

  services = adminServices(
    initEmulatorApp({ projectId: PROJECT_ID, databaseURL: `http://127.0.0.1:9000?ns=${DATABASE_NS}` }, 'integration'),
  );
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: { rules: readFileSync(root('database.rules.json'), 'utf8') },
    firestore: { rules: readFileSync(root('firestore.rules'), 'utf8') },
  });

  const { firestore } = services;
  for (const user of [alice, bob, carol, dave]) {
    await firestore.doc(`users/${user.uid}`).set({ name: user.name, nameLower: user.name.toLowerCase(), photoUrl: '', createdAt: 1 });
    await firestore.doc(`users/${user.uid}/private/profile`).set({
      email: `${user.name.toLowerCase()}@exemplo.com`,
      phoneNumber: '11912345678',
      birthDate: '2000-05-10',
    });
  }
  for (const user of [bob, carol]) {
    await firestore.doc(`users/${user.uid}/devices/dev-${user.name}`).set({
      token: `fcm-token-${user.name}`.padEnd(40, 'x'),
      tokenType: 'fcm',
      platform: 'android',
      enabled: true,
      updatedAt: 1,
    });
  }
  await firestore.doc(`groups/${GROUP_ID}`).set({
    name: 'Turma Integração',
    photoUrl: '',
    ownerId: alice.uid,
    memberIds: [alice.uid, bob.uid, carol.uid],
    memberLimit: 4,
    notificationPolicy: 'all_group_messages',
    createdAt: 1,
    updatedAt: 1,
  });

  const app = createApp({
    auth: { verifyIdToken: (token) => services.auth.verifyIdToken(token, true) },
    store: createFirebaseStore(services),
    push,
    includePreview: true,
    trustProxy: 0,
    version: 'integration',
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  await env?.cleanup();
});

const clientDb = (user: TestUser) => env.authenticatedContext(user.uid).database();

const message = (senderId: string, overrides: Record<string, unknown> = {}) => ({
  conversationId: GROUP_ID,
  conversationType: 'group',
  senderId,
  text: 'Olá, turma!',
  target: { type: 'conversation' },
  createdAt: serverTimestamp(),
  ...overrides,
});

describe('autenticação (tokens reais do Firebase Auth Emulator)', () => {
  it('health é público; rotas protegidas exigem Firebase ID Token', async () => {
    expect((await api('/health', null, undefined, 'GET')).status).toBe(200);
    expect((await notify(null, 'm1')).status).toBe(401);
    expect((await api('/notifications/messages', { ...alice, token: 'token-invalido' }, { conversationId: GROUP_ID, messageId: 'm1' })).status).toBe(401);
  });
});

describe('fluxo do grupo: espelho de integrantes → regras do RTDB → push', () => {
  it('antes da sincronização o grupo ainda não tem acesso às mensagens (RTDB nega)', async () => {
    await assertFails(set(ref(clientDb(alice), `messages/${GROUP_ID}/m0`), message(alice.uid)));
  });

  it('somente o proprietário sincroniza os integrantes', async () => {
    expect((await api(`/groups/${GROUP_ID}/sync-members`, bob)).status).toBe(403);
    const synced = await api(`/groups/${GROUP_ID}/sync-members`, alice);
    expect(synced.status).toBe(200);
    expect(synced.json['memberCount']).toBe(3);
  });

  it('depois da sincronização, integrantes enviam/leem e quem está fora continua bloqueado', async () => {
    await assertSucceeds(set(ref(clientDb(alice), `messages/${GROUP_ID}/m1`), message(alice.uid)));
    await assertSucceeds(get(ref(clientDb(bob), `messages/${GROUP_ID}`)));
    await assertFails(get(ref(clientDb(dave), `messages/${GROUP_ID}`)));
    await assertFails(set(ref(clientDb(dave), `messages/${GROUP_ID}/m9`), message(dave.uid)));
  });

  it('push: calcula os destinatários no servidor e notifica todos menos o remetente', async () => {
    const result = await notify(alice, 'm1');
    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({ status: 'sent', recipients: 2, devices: 2, sent: 2 });
    expect(push.sent).toHaveLength(1);
    expect(push.sent[0]?.devices.map((device) => device.uid).sort()).toEqual([bob.uid, carol.uid].sort());
    expect(push.sent[0]?.content.data).toMatchObject({ conversationId: GROUP_ID, conversationType: 'group', messageId: 'm1' });
    expect(push.sent[0]?.content.title).toBe('Turma Integração');
    expect(push.sent[0]?.content.body).toBe('Alice: Olá, turma!');
  });

  it('idempotência: reenvios (inclusive simultâneos) não geram push duplicado', async () => {
    await assertSucceeds(set(ref(clientDb(alice), `messages/${GROUP_ID}/m2`), message(alice.uid, { text: 'segunda' })));
    const before = push.sent.length;
    const results = await Promise.all(Array.from({ length: 6 }, () => notify(alice, 'm2')));
    const outcomes = results.map((result) => result.json['status']);
    expect(outcomes.filter((status) => status === 'sent')).toHaveLength(1);
    expect(outcomes.filter((status) => status === 'duplicate')).toHaveLength(5);
    expect(push.sent.length - before).toBe(1);
  });

  it('segurança: não dá para pedir push de mensagem alheia nem de mensagem inexistente', async () => {
    expect((await notify(bob, 'm1')).status).toBe(403);
    expect((await notify(alice, 'nao-existe')).status).toBe(404);
  });

  it('mentioned_members: só o integrante selecionado é notificado', async () => {
    await services.firestore.doc(`groups/${GROUP_ID}`).update({ notificationPolicy: 'mentioned_members' });
    await assertSucceeds(
      set(ref(clientDb(alice), `messages/${GROUP_ID}/m3`), message(alice.uid, { target: { type: 'member', memberId: carol.uid } })),
    );
    const before = push.sent.length;
    expect((await notify(alice, 'm3')).json).toMatchObject({ status: 'sent', recipients: 1 });
    expect(push.sent[before]?.devices.map((device) => device.uid)).toEqual([carol.uid]);
  });

  it('disabled: nenhuma notificação', async () => {
    await services.firestore.doc(`groups/${GROUP_ID}`).update({ notificationPolicy: 'disabled' });
    await assertSucceeds(set(ref(clientDb(alice), `messages/${GROUP_ID}/m4`), message(alice.uid)));
    const before = push.sent.length;
    expect((await notify(alice, 'm4')).json['status']).toBe('no_recipients');
    expect(push.sent.length).toBe(before);
  });

  it('remover alguém: após a sincronização ele perde o acesso às mensagens e ao push', async () => {
    await services.firestore.doc(`groups/${GROUP_ID}`).update({
      memberIds: [alice.uid, bob.uid],
      notificationPolicy: 'all_group_messages',
    });
    await api(`/groups/${GROUP_ID}/sync-members`, alice);

    await assertFails(get(ref(clientDb(carol), `messages/${GROUP_ID}`)));
    await assertFails(set(ref(clientDb(carol), `messages/${GROUP_ID}/m5`), message(carol.uid)));
    await assertSucceeds(set(ref(clientDb(alice), `messages/${GROUP_ID}/m6`), message(alice.uid, { text: 'sem a Carol' })));

    const before = push.sent.length;
    expect((await notify(alice, 'm6')).json).toMatchObject({ status: 'sent', recipients: 1 });
    expect(push.sent[before]?.devices.map((device) => device.uid)).toEqual([bob.uid]);
  });

  it('o ex-integrante não consegue pedir push em nome do grupo', async () => {
    expect((await notify(carol, 'm6')).status).toBe(403);
  });

  it('a API recusa sincronizar um grupo acima do limite', async () => {
    await services.firestore.doc(`groups/${GROUP_ID}`).update({
      memberIds: [alice.uid, bob.uid, carol.uid, dave.uid],
      memberLimit: 3,
    });
    expect((await api(`/groups/${GROUP_ID}/sync-members`, alice)).status).toBe(403);
    await services.firestore.doc(`groups/${GROUP_ID}`).update({ memberIds: [alice.uid, bob.uid], memberLimit: 4 });
  });
});

describe('conversa individual', () => {
  const directId = (a: string, b: string): string => (a < b ? `${a}_${b}` : `${b}_${a}`);

  it('notifica o outro participante e respeita tokens desativados', async () => {
    const id = directId(alice.uid, bob.uid);
    await services.firestore.doc(`directConversations/${id}`).set({ participantIds: [alice.uid, bob.uid].sort(), createdAt: 1 });
    await assertSucceeds(
      set(ref(clientDb(alice), `messages/${id}/d1`), message(alice.uid, { conversationId: id, conversationType: 'direct', text: 'Oi Bob' })),
    );
    const before = push.sent.length;
    const result = await api('/notifications/messages', alice, { conversationId: id, messageId: 'd1' });
    expect(result.json).toMatchObject({ status: 'sent', recipients: 1 });
    expect(push.sent[before]?.devices.map((device) => device.uid)).toEqual([bob.uid]);
    expect(push.sent[before]?.content.title).toBe('Alice');

    // Bob desliga as notificações neste aparelho → a API não envia mais para ele.
    await services.firestore.doc(`users/${bob.uid}/devices/dev-Bob`).update({ enabled: false });
    await assertSucceeds(
      set(ref(clientDb(alice), `messages/${id}/d2`), message(alice.uid, { conversationId: id, conversationType: 'direct', text: 'de novo' })),
    );
    const afterToggle = await api('/notifications/messages', alice, { conversationId: id, messageId: 'd2' });
    expect(afterToggle.json['status']).toBe('no_devices');
    await services.firestore.doc(`users/${bob.uid}/devices/dev-Bob`).update({ enabled: true });
  });
});

describe('perfil: dados cadastrais só com conversa ou grupo em comum', () => {
  it('Bob (mesmo grupo) vê o perfil da Alice; Dave (sem relação) não', async () => {
    const allowed = await api(`/users/${alice.uid}/profile`, bob, undefined, 'GET');
    expect(allowed.status).toBe(200);
    expect(allowed.json).toMatchObject({ name: 'Alice', email: 'alice@exemplo.com', phoneNumber: '11912345678', birthDate: '2000-05-10' });

    const denied = await api(`/users/${alice.uid}/profile`, dave, undefined, 'GET');
    expect(denied.status).toBe(403);
    expect(denied.json).not.toHaveProperty('email');
  });

  it('Carol (removida do grupo) perde o acesso ao perfil da Alice', async () => {
    expect((await api(`/users/${alice.uid}/profile`, carol, undefined, 'GET')).status).toBe(403);
  });
});

describe('dispositivos', () => {
  it('claim remove o mesmo token registrado por outro usuário (consulta collection group real)', async () => {
    const shared = 'token-compartilhado'.padEnd(40, 'x');
    await services.firestore.doc(`users/${carol.uid}/devices/aparelho`).set({ token: shared, tokenType: 'fcm', platform: 'android', enabled: true, updatedAt: 1 });
    await services.firestore.doc(`users/${dave.uid}/devices/aparelho`).set({ token: shared, tokenType: 'fcm', platform: 'android', enabled: true, updatedAt: 2 });

    const result = await api('/devices/claim', dave, { deviceId: 'aparelho' });
    expect(result.json['released']).toBe(1);
    expect((await services.firestore.doc(`users/${carol.uid}/devices/aparelho`).get()).exists).toBe(false);
    expect((await services.firestore.doc(`users/${dave.uid}/devices/aparelho`).get()).exists).toBe(true);
  });
});
