import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, runTransaction, setDoc, updateDoc, where } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { ALICE, BOB, CAROL, DAVE, createTestEnv, directId, groupId, uid } from './helpers.js';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

const as = (uid: string, email = `${uid.slice(0, 5)}@exemplo.com`) =>
  env.authenticatedContext(uid, { email }).firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

const publicProfile = (name: string) => ({ name, nameLower: name.toLowerCase(), photoUrl: '', createdAt: 1 });
const privateProfile = (email: string) => ({ email, phoneNumber: '11912345678', birthDate: '2000-05-10' });

const GROUP = groupId('turma');

const baseGroup = (overrides: Record<string, unknown> = {}) => ({
  name: 'Turma 3SI',
  photoUrl: '',
  ownerId: ALICE,
  memberIds: [ALICE, BOB, CAROL],
  memberLimit: 5,
  notificationPolicy: 'all_group_messages',
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

async function seed(path: string, data: Record<string, unknown>): Promise<void> {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

describe('perfis', () => {
  it('usuário autenticado lê o perfil público de outros, mas visitante não', async () => {
    await seed(`users/${BOB}`, publicProfile('Bob'));
    await assertSucceeds(getDoc(doc(as(ALICE), `users/${BOB}`)));
    await assertFails(getDoc(doc(anonymous(), `users/${BOB}`)));
  });

  it('lista de usuários (busca) funciona para autenticados', async () => {
    await seed(`users/${BOB}`, publicProfile('Bob'));
    await assertSucceeds(getDocs(collection(as(ALICE), 'users')));
  });

  it('dados cadastrais (e-mail, celular, nascimento) só o dono lê', async () => {
    await seed(`users/${BOB}/private/profile`, privateProfile('bob@exemplo.com'));
    await assertSucceeds(getDoc(doc(as(BOB), `users/${BOB}/private/profile`)));
    await assertFails(getDoc(doc(as(ALICE), `users/${BOB}/private/profile`)));
    await assertFails(getDocs(collection(as(ALICE), `users/${BOB}/private`)));
  });

  it('cria o próprio perfil, mas não o de outra pessoa', async () => {
    await assertSucceeds(setDoc(doc(as(ALICE), `users/${ALICE}`), publicProfile('Alice')));
    await assertFails(setDoc(doc(as(ALICE), `users/${BOB}`), publicProfile('Bob')));
  });

  it('o perfil privado precisa ter o e-mail da conta autenticada', async () => {
    await assertSucceeds(
      setDoc(doc(as(ALICE, 'alice@exemplo.com'), `users/${ALICE}/private/profile`), privateProfile('alice@exemplo.com')),
    );
    await assertFails(
      setDoc(doc(as(ALICE, 'alice@exemplo.com'), `users/${ALICE}/private/profile`), privateProfile('outro@exemplo.com')),
    );
  });

  it('rejeita data de nascimento fora do formato e campos extras', async () => {
    const db = as(ALICE, 'alice@exemplo.com');
    await assertFails(
      setDoc(doc(db, `users/${ALICE}/private/profile`), { ...privateProfile('alice@exemplo.com'), birthDate: '10/05/2000' }),
    );
    await assertFails(setDoc(doc(db, `users/${ALICE}`), { ...publicProfile('Alice'), isAdmin: true }));
  });

  it('o perfil não pode ser apagado e createdAt não muda', async () => {
    await seed(`users/${ALICE}`, publicProfile('Alice'));
    await assertFails(deleteDoc(doc(as(ALICE), `users/${ALICE}`)));
    await assertFails(updateDoc(doc(as(ALICE), `users/${ALICE}`), { createdAt: 999 }));
    await assertSucceeds(updateDoc(doc(as(ALICE), `users/${ALICE}`), { photoUrl: 'https://img/a.jpg' }));
  });
});

describe('tokens de dispositivos', () => {
  const device = { token: 'x'.repeat(40), tokenType: 'fcm', platform: 'android', enabled: true, updatedAt: 1 };

  it('somente o dono lê e grava seus dispositivos', async () => {
    await assertSucceeds(setDoc(doc(as(ALICE), `users/${ALICE}/devices/d1`), device));
    await assertSucceeds(getDoc(doc(as(ALICE), `users/${ALICE}/devices/d1`)));
    await assertFails(getDoc(doc(as(BOB), `users/${ALICE}/devices/d1`)));
    await assertFails(getDocs(collection(as(BOB), `users/${ALICE}/devices`)));
    await assertFails(setDoc(doc(as(BOB), `users/${ALICE}/devices/d2`), device));
    await assertFails(getDoc(doc(anonymous(), `users/${ALICE}/devices/d1`)));
  });

  it('valida o formato do registro', async () => {
    const db = as(ALICE);
    await assertFails(setDoc(doc(db, `users/${ALICE}/devices/d1`), { ...device, tokenType: 'apns' }));
    await assertFails(setDoc(doc(db, `users/${ALICE}/devices/d1`), { ...device, enabled: 'sim' }));
    await assertFails(setDoc(doc(db, `users/${ALICE}/devices/d1`), { token: device.token }));
  });

  it('o dono pode desativar e remover o dispositivo', async () => {
    await seed(`users/${ALICE}/devices/d1`, device);
    await assertSucceeds(updateDoc(doc(as(ALICE), `users/${ALICE}/devices/d1`), { enabled: false }));
    await assertSucceeds(deleteDoc(doc(as(ALICE), `users/${ALICE}/devices/d1`)));
  });
});

describe('grupos — leitura', () => {
  beforeEach(async () => {
    await seed(`groups/${GROUP}`, baseGroup());
  });

  it('integrantes leem; quem não participa não lê', async () => {
    await assertSucceeds(getDoc(doc(as(BOB), `groups/${GROUP}`)));
    await assertFails(getDoc(doc(as(DAVE), `groups/${GROUP}`)));
    await assertFails(getDoc(doc(anonymous(), `groups/${GROUP}`)));
  });

  it('a lista de grupos do usuário só devolve grupos em que ele está', async () => {
    const mine = query(collection(as(BOB), 'groups'), where('memberIds', 'array-contains', BOB));
    await assertSucceeds(getDocs(mine));
    const others = query(collection(as(DAVE), 'groups'), where('memberIds', 'array-contains', BOB));
    await assertFails(getDocs(others));
  });
});

describe('grupos — criação', () => {
  it('o proprietário cria um grupo válido', async () => {
    await assertSucceeds(setDoc(doc(as(ALICE), `groups/${GROUP}`), baseGroup()));
  });

  it('recusa grupo criado em nome de outro proprietário', async () => {
    await assertFails(setDoc(doc(as(BOB), `groups/${GROUP}`), baseGroup({ ownerId: ALICE })));
  });

  it('recusa grupo com mais integrantes que o limite', async () => {
    await assertFails(setDoc(doc(as(ALICE), `groups/${GROUP}`), baseGroup({ memberLimit: 2 })));
  });

  it('recusa grupo com menos de 2 integrantes ou sem o proprietário', async () => {
    await assertFails(setDoc(doc(as(ALICE), `groups/${GROUP}`), baseGroup({ memberIds: [ALICE] })));
    await assertFails(setDoc(doc(as(ALICE), `groups/${GROUP}`), baseGroup({ memberIds: [BOB, CAROL] })));
  });

  it('recusa integrantes duplicados, limite inválido, política inválida e campos extras', async () => {
    const db = as(ALICE);
    await assertFails(setDoc(doc(db, `groups/${GROUP}`), baseGroup({ memberIds: [ALICE, BOB, BOB] })));
    await assertFails(setDoc(doc(db, `groups/${GROUP}`), baseGroup({ memberLimit: 1 })));
    await assertFails(setDoc(doc(db, `groups/${GROUP}`), baseGroup({ memberLimit: 51 })));
    await assertFails(setDoc(doc(db, `groups/${GROUP}`), baseGroup({ memberLimit: 5.5 })));
    await assertFails(setDoc(doc(db, `groups/${GROUP}`), baseGroup({ notificationPolicy: 'tudo' })));
    await assertFails(setDoc(doc(db, `groups/${GROUP}`), baseGroup({ extra: true })));
  });

  it('exige id de grupo no formato automático (20 caracteres)', async () => {
    await assertFails(setDoc(doc(as(ALICE), `groups/${ALICE}_${BOB}`), baseGroup()));
  });
});

describe('grupos — gerenciamento e limite de integrantes', () => {
  beforeEach(async () => {
    await seed(`groups/${GROUP}`, baseGroup({ memberLimit: 4 }));
  });

  it('o proprietário adiciona integrante enquanto há vaga', async () => {
    await assertSucceeds(updateDoc(doc(as(ALICE), `groups/${GROUP}`), { memberIds: [ALICE, BOB, CAROL, DAVE] }));
  });

  it('nenhum integrante entra além do limite (mesmo com o proprietário burlando a interface)', async () => {
    await seed(`groups/${GROUP}`, baseGroup({ memberLimit: 3 }));
    await assertFails(updateDoc(doc(as(ALICE), `groups/${GROUP}`), { memberIds: [ALICE, BOB, CAROL, DAVE] }));
  });

  it('não permite reduzir o limite abaixo da quantidade atual de integrantes', async () => {
    await assertFails(updateDoc(doc(as(ALICE), `groups/${GROUP}`), { memberLimit: 2 }));
    await assertSucceeds(updateDoc(doc(as(ALICE), `groups/${GROUP}`), { memberLimit: 3 }));
  });

  it('transações concorrentes na última vaga: uma passa e a outra é recusada', async () => {
    const db = as(ALICE);
    const groupRef = doc(db, `groups/${GROUP}`);
    const addMember = (memberId: string) =>
      runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(groupRef);
        const members: string[] = snapshot.data()?.['memberIds'] ?? [];
        transaction.update(groupRef, { memberIds: [...members, memberId] });
      });

    // Limite 4, 3 integrantes: há exatamente 1 vaga para 2 tentativas simultâneas.
    const results = await Promise.allSettled([addMember(DAVE), addMember(uid('erin'))]);
    const succeeded = results.filter((result) => result.status === 'fulfilled').length;
    if (succeeded !== 1) throw new Error(`esperado exatamente 1 sucesso, obtido ${succeeded}`);

    let size = 0;
    await env.withSecurityRulesDisabled(async (context) => {
      const final = await getDoc(doc(context.firestore(), `groups/${GROUP}`));
      size = (final.data()?.['memberIds'] as string[]).length;
    });
    if (size !== 4) throw new Error(`o grupo deveria ter exatamente 4 integrantes, tem ${size}`);
  });

  it('integrante que não é proprietário não altera nada', async () => {
    const db = as(BOB);
    await assertFails(updateDoc(doc(db, `groups/${GROUP}`), { name: 'Hackeado' }));
    await assertFails(updateDoc(doc(db, `groups/${GROUP}`), { memberIds: [ALICE, BOB, CAROL, DAVE] }));
    await assertFails(updateDoc(doc(db, `groups/${GROUP}`), { notificationPolicy: 'disabled' }));
    await assertFails(updateDoc(doc(db, `groups/${GROUP}`), { ownerId: BOB }));
  });

  it('o proprietário não troca o dono, não remove a si mesmo e não apaga o grupo', async () => {
    const db = as(ALICE);
    await assertFails(updateDoc(doc(db, `groups/${GROUP}`), { ownerId: BOB }));
    await assertFails(updateDoc(doc(db, `groups/${GROUP}`), { memberIds: [BOB, CAROL] }));
    await assertFails(deleteDoc(doc(db, `groups/${GROUP}`)));
  });

  it('o proprietário remove integrantes (mantendo ao menos 2) e altera a política', async () => {
    const db = as(ALICE);
    await assertSucceeds(updateDoc(doc(db, `groups/${GROUP}`), { memberIds: [ALICE, BOB] }));
    await assertFails(updateDoc(doc(db, `groups/${GROUP}`), { memberIds: [ALICE] }));
    await assertSucceeds(updateDoc(doc(db, `groups/${GROUP}`), { notificationPolicy: 'mentioned_members' }));
  });

  it('usuário removido deixa de ler o grupo', async () => {
    await assertSucceeds(getDoc(doc(as(CAROL), `groups/${GROUP}`)));
    await assertSucceeds(updateDoc(doc(as(ALICE), `groups/${GROUP}`), { memberIds: [ALICE, BOB] }));
    await assertFails(getDoc(doc(as(CAROL), `groups/${GROUP}`)));
  });
});

describe('conversas individuais', () => {
  const conversation = (a: string, b: string) => ({ participantIds: [a < b ? a : b, a < b ? b : a], createdAt: 1 });

  it('cria a conversa entre dois usuários com id derivado dos uids ordenados', async () => {
    await assertSucceeds(setDoc(doc(as(ALICE), `directConversations/${directId(ALICE, BOB)}`), conversation(ALICE, BOB)));
    await assertSucceeds(setDoc(doc(as(DAVE), `directConversations/${directId(DAVE, BOB)}`), conversation(DAVE, BOB)));
  });

  it('não permite duas conversas diferentes para o mesmo par (id inconsistente)', async () => {
    const reversedId = `${BOB}_${ALICE}`; // ordem trocada → id inválido
    await assertFails(setDoc(doc(as(ALICE), `directConversations/${reversedId}`), conversation(ALICE, BOB)));
    await assertFails(setDoc(doc(as(ALICE), `directConversations/qualquer-id`), conversation(ALICE, BOB)));
  });

  it('não permite conversa consigo mesmo', async () => {
    await assertFails(
      setDoc(doc(as(ALICE), `directConversations/${ALICE}_${ALICE}`), { participantIds: [ALICE, ALICE], createdAt: 1 }),
    );
  });

  it('não permite criar conversa entre outras duas pessoas', async () => {
    await assertFails(setDoc(doc(as(CAROL), `directConversations/${directId(ALICE, BOB)}`), conversation(ALICE, BOB)));
  });

  it('só os participantes leem; localizar por id também só é permitido a quem participa', async () => {
    await seed(`directConversations/${directId(ALICE, BOB)}`, conversation(ALICE, BOB));
    await assertSucceeds(getDoc(doc(as(ALICE), `directConversations/${directId(ALICE, BOB)}`)));
    await assertSucceeds(getDoc(doc(as(BOB), `directConversations/${directId(ALICE, BOB)}`)));
    await assertFails(getDoc(doc(as(CAROL), `directConversations/${directId(ALICE, BOB)}`)));
    // Conversa ainda inexistente: o próprio par consegue consultar (para decidir criar).
    await assertSucceeds(getDoc(doc(as(ALICE), `directConversations/${directId(ALICE, DAVE)}`)));
  });

  it('listagem filtrada pelo próprio uid funciona; consultar a lista de outro, não', async () => {
    await seed(`directConversations/${directId(ALICE, BOB)}`, conversation(ALICE, BOB));
    await assertSucceeds(
      getDocs(query(collection(as(ALICE), 'directConversations'), where('participantIds', 'array-contains', ALICE))),
    );
    await assertFails(
      getDocs(query(collection(as(CAROL), 'directConversations'), where('participantIds', 'array-contains', ALICE))),
    );
  });

  it('conversas não podem ser alteradas nem apagadas', async () => {
    await seed(`directConversations/${directId(ALICE, BOB)}`, conversation(ALICE, BOB));
    await assertFails(updateDoc(doc(as(ALICE), `directConversations/${directId(ALICE, BOB)}`), { createdAt: 2 }));
    await assertFails(deleteDoc(doc(as(ALICE), `directConversations/${directId(ALICE, BOB)}`)));
  });
});

describe('coleções internas', () => {
  it('controle de idempotência do push só é acessível pela API (Admin SDK)', async () => {
    await seed('notificationDispatches/x__y', { status: 'sent' });
    await assertFails(getDoc(doc(as(ALICE), 'notificationDispatches/x__y')));
    await assertFails(setDoc(doc(as(ALICE), 'notificationDispatches/novo'), { status: 'sent' }));
  });

  it('coleções desconhecidas são negadas por padrão', async () => {
    await assertFails(setDoc(doc(as(ALICE), 'qualquerCoisa/doc'), { a: 1 }));
    await assertFails(getDoc(doc(as(ALICE), 'qualquerCoisa/doc')));
  });
});
