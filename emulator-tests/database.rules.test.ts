import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { get, limitToLast, orderByChild, push, query, ref, remove, serverTimestamp, set, update } from 'firebase/database';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { ALICE, BOB, CAROL, DAVE, createTestEnv, directId, groupId } from './helpers.js';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearDatabase();
});

const as = (uid: string) => env.authenticatedContext(uid).database();
const anonymous = () => env.unauthenticatedContext().database();

const GROUP = groupId('turma');
const DIRECT = directId(ALICE, BOB);

/** O espelho `groupMembers` é escrito somente pela API (Admin SDK); aqui simulamos isso. */
async function mirrorGroup(id: string, members: string[]): Promise<void> {
  await env.withSecurityRulesDisabled(async (context) => {
    const entries = Object.fromEntries(members.map((uid) => [uid, true]));
    await set(ref(context.database(), `groupMembers/${id}`), entries);
  });
}

async function seedMessage(conversationId: string, messageId: string, senderId: string, type: 'group' | 'direct'): Promise<void> {
  await env.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database(), `messages/${conversationId}/${messageId}`), {
      conversationId,
      conversationType: type,
      senderId,
      text: 'mensagem antiga',
      target: { type: 'conversation' },
      createdAt: 1,
    });
  });
}

type MessageOverrides = Record<string, unknown>;

const groupMessage = (senderId: string, overrides: MessageOverrides = {}) => ({
  conversationId: GROUP,
  conversationType: 'group',
  senderId,
  text: 'Olá, pessoal!',
  target: { type: 'conversation' },
  createdAt: serverTimestamp(),
  ...overrides,
});

const directMessage = (senderId: string, overrides: MessageOverrides = {}) => ({
  conversationId: DIRECT,
  conversationType: 'direct',
  senderId,
  text: 'Oi!',
  target: { type: 'conversation' },
  createdAt: serverTimestamp(),
  ...overrides,
});

const messagePath = (conversationId: string, messageId = 'm1') => `messages/${conversationId}/${messageId}`;

describe('mensagens de grupo — acesso', () => {
  beforeEach(async () => {
    await mirrorGroup(GROUP, [ALICE, BOB]);
  });

  it('integrantes enviam e leem mensagens', async () => {
    await assertSucceeds(set(ref(as(ALICE), messagePath(GROUP)), groupMessage(ALICE)));
    await assertSucceeds(get(ref(as(BOB), `messages/${GROUP}`)));
    await assertSucceeds(
      get(query(ref(as(BOB), `messages/${GROUP}`), orderByChild('createdAt'), limitToLast(50))),
    );
  });

  it('quem não é integrante não lê nem envia', async () => {
    await assertFails(get(ref(as(CAROL), `messages/${GROUP}`)));
    await assertFails(set(ref(as(CAROL), messagePath(GROUP)), groupMessage(CAROL)));
  });

  it('visitante (sem login) não lê nem envia', async () => {
    await assertFails(get(ref(anonymous(), `messages/${GROUP}`)));
    await assertFails(set(ref(anonymous(), messagePath(GROUP)), groupMessage(ALICE)));
  });

  it('usuário removido do grupo não lê nem envia novas mensagens', async () => {
    await assertSucceeds(set(ref(as(BOB), messagePath(GROUP, 'antes')), groupMessage(BOB)));
    await mirrorGroup(GROUP, [ALICE]); // a API remove o integrante do espelho
    await assertFails(get(ref(as(BOB), `messages/${GROUP}`)));
    await assertFails(set(ref(as(BOB), messagePath(GROUP, 'depois')), groupMessage(BOB)));
    await assertSucceeds(get(ref(as(ALICE), `messages/${GROUP}`)));
  });

  it('o cliente não consegue se adicionar ao espelho de integrantes', async () => {
    await assertFails(set(ref(as(CAROL), `groupMembers/${GROUP}/${CAROL}`), true));
    await assertFails(get(ref(as(ALICE), `groupMembers/${GROUP}`)));
  });

  it('a raiz do banco não pode ser lida', async () => {
    await assertFails(get(ref(as(ALICE), '/')));
    await assertFails(get(ref(as(ALICE), 'messages')));
  });
});

describe('mensagens de grupo — validação', () => {
  beforeEach(async () => {
    await mirrorGroup(GROUP, [ALICE, BOB]);
  });

  it('o senderId precisa ser o usuário autenticado', async () => {
    await assertFails(set(ref(as(ALICE), messagePath(GROUP)), groupMessage(BOB)));
  });

  it('o conversationId da mensagem precisa ser o da conversa', async () => {
    await assertFails(set(ref(as(ALICE), messagePath(GROUP)), groupMessage(ALICE, { conversationId: 'outra' })));
  });

  it('o horário é o do servidor (não aceita data enviada pelo cliente)', async () => {
    await assertFails(set(ref(as(ALICE), messagePath(GROUP)), groupMessage(ALICE, { createdAt: 12345 })));
  });

  it('exige texto entre 1 e 2000 caracteres', async () => {
    await assertFails(set(ref(as(ALICE), messagePath(GROUP)), groupMessage(ALICE, { text: '' })));
    await assertFails(set(ref(as(ALICE), messagePath(GROUP)), groupMessage(ALICE, { text: 'a'.repeat(2001) })));
    await assertSucceeds(set(ref(as(ALICE), messagePath(GROUP)), groupMessage(ALICE, { text: 'a'.repeat(2000) })));
  });

  it('rejeita campos desconhecidos e mensagens incompletas', async () => {
    await assertFails(set(ref(as(ALICE), messagePath(GROUP)), groupMessage(ALICE, { isAdmin: true })));
    await assertFails(set(ref(as(ALICE), messagePath(GROUP)), { senderId: ALICE, text: 'sem campos' }));
  });

  it('o tipo da conversa precisa ser coerente com o identificador', async () => {
    await assertFails(set(ref(as(ALICE), messagePath(GROUP)), groupMessage(ALICE, { conversationType: 'direct' })));
  });

  it('mensagem direcionada só pode ter como destino um integrante do grupo', async () => {
    const ok = groupMessage(ALICE, { target: { type: 'member', memberId: BOB } });
    await assertSucceeds(set(ref(as(ALICE), messagePath(GROUP, 'ok')), ok));
    const stranger = groupMessage(ALICE, { target: { type: 'member', memberId: CAROL } });
    await assertFails(set(ref(as(ALICE), messagePath(GROUP, 'ruim')), stranger));
    const noMember = groupMessage(ALICE, { target: { type: 'member' } });
    await assertFails(set(ref(as(ALICE), messagePath(GROUP, 'ruim2')), noMember));
  });

  it('menções precisam ser de integrantes do grupo', async () => {
    await assertSucceeds(set(ref(as(ALICE), messagePath(GROUP, 'ok')), groupMessage(ALICE, { mentionedUserIds: [BOB] })));
    await assertFails(set(ref(as(ALICE), messagePath(GROUP, 'ruim')), groupMessage(ALICE, { mentionedUserIds: [BOB, DAVE] })));
  });

  it('mensagens são imutáveis: não podem ser editadas nem apagadas', async () => {
    await seedMessage(GROUP, 'antiga', ALICE, 'group');
    await assertFails(set(ref(as(ALICE), messagePath(GROUP, 'antiga')), groupMessage(ALICE, { text: 'editada' })));
    await assertFails(remove(ref(as(ALICE), messagePath(GROUP, 'antiga'))));
    await assertFails(remove(ref(as(BOB), messagePath(GROUP, 'antiga'))));
  });

  it('não é possível apagar o histórico inteiro', async () => {
    await seedMessage(GROUP, 'antiga', ALICE, 'group');
    await assertFails(remove(ref(as(ALICE), `messages/${GROUP}`)));
  });
});

describe('resumo da conversa (conversationMeta) e escrita atômica', () => {
  beforeEach(async () => {
    await mirrorGroup(GROUP, [ALICE, BOB]);
  });

  it('o app grava mensagem + última mensagem na mesma escrita (multi-path update)', async () => {
    const db = as(ALICE);
    const messageId = push(ref(db, `messages/${GROUP}`)).key;
    await assertSucceeds(
      update(ref(db), {
        [`messages/${GROUP}/${messageId}`]: groupMessage(ALICE),
        [`conversationMeta/${GROUP}/lastMessage`]: { text: 'Olá, pessoal!', senderId: ALICE, createdAt: serverTimestamp() },
      }),
    );
    await assertSucceeds(get(ref(as(BOB), `conversationMeta/${GROUP}/lastMessage`)));
  });

  it('o resumo precisa ser do usuário autenticado', async () => {
    await assertFails(
      set(ref(as(ALICE), `conversationMeta/${GROUP}/lastMessage`), { text: 'x', senderId: BOB, createdAt: serverTimestamp() }),
    );
  });

  it('quem não é integrante não lê nem altera o resumo', async () => {
    await assertFails(get(ref(as(CAROL), `conversationMeta/${GROUP}/lastMessage`)));
    await assertFails(
      set(ref(as(CAROL), `conversationMeta/${GROUP}/lastMessage`), { text: 'x', senderId: CAROL, createdAt: serverTimestamp() }),
    );
  });

  it('uma escrita atômica inválida não grava nada (mensagem de impostor)', async () => {
    const db = as(CAROL);
    await assertFails(
      update(ref(db), {
        [`messages/${GROUP}/m1`]: groupMessage(CAROL),
        [`conversationMeta/${GROUP}/lastMessage`]: { text: 'x', senderId: CAROL, createdAt: serverTimestamp() },
      }),
    );
    await env.withSecurityRulesDisabled(async (context) => {
      const snapshot = await get(ref(context.database(), `messages/${GROUP}`));
      if (snapshot.exists()) throw new Error('a mensagem foi gravada apesar da recusa');
    });
  });
});

describe('mensagens individuais', () => {
  it('os dois participantes enviam e leem', async () => {
    await assertSucceeds(set(ref(as(ALICE), messagePath(DIRECT)), directMessage(ALICE)));
    await assertSucceeds(set(ref(as(BOB), messagePath(DIRECT, 'm2')), directMessage(BOB)));
    await assertSucceeds(get(ref(as(ALICE), `messages/${DIRECT}`)));
    await assertSucceeds(get(ref(as(BOB), `messages/${DIRECT}`)));
  });

  it('um terceiro não lê nem escreve na conversa', async () => {
    await assertFails(get(ref(as(CAROL), `messages/${DIRECT}`)));
    await assertFails(set(ref(as(CAROL), messagePath(DIRECT)), directMessage(CAROL)));
  });

  it('não é possível se passar pelo outro participante', async () => {
    await assertFails(set(ref(as(ALICE), messagePath(DIRECT)), directMessage(BOB)));
  });

  it('mensagem individual não pode ter destinatário de grupo nem tipo de grupo', async () => {
    await assertFails(set(ref(as(ALICE), messagePath(DIRECT)), directMessage(ALICE, { target: { type: 'member', memberId: BOB } })));
    await assertFails(set(ref(as(ALICE), messagePath(DIRECT)), directMessage(ALICE, { conversationType: 'group' })));
  });

  it('cada usuário só consegue abrir conversas em que o próprio uid faz parte do identificador', async () => {
    const pairOfOthers = directId(BOB, CAROL);
    await assertFails(get(ref(as(ALICE), `messages/${pairOfOthers}`)));
    await assertFails(
      set(ref(as(ALICE), messagePath(pairOfOthers)), directMessage(ALICE, { conversationId: pairOfOthers })),
    );
  });

  it('identificadores fora do padrão de conversa individual são negados', async () => {
    await assertFails(set(ref(as(ALICE), messagePath('qualquer')), directMessage(ALICE, { conversationId: 'qualquer' })));
  });

  it('resumo da conversa individual', async () => {
    await assertSucceeds(
      set(ref(as(ALICE), `conversationMeta/${DIRECT}/lastMessage`), { text: 'Oi!', senderId: ALICE, createdAt: serverTimestamp() }),
    );
    await assertSucceeds(get(ref(as(BOB), `conversationMeta/${DIRECT}/lastMessage`)));
    await assertFails(get(ref(as(CAROL), `conversationMeta/${DIRECT}/lastMessage`)));
  });
});
