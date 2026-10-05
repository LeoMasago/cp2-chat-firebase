import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { ALICE, BOB, createTestEnv } from './helpers.js';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(async () => {
  await env.cleanup();
});

const as = (uid: string) => env.authenticatedContext(uid).storage();
const anonymous = () => env.unauthenticatedContext().storage();

const image = (bytes = 1024) => new Uint8Array(bytes).fill(7);
const JPEG = { contentType: 'image/jpeg' };

describe('foto de perfil', () => {
  it('o dono envia uma imagem de até 5 MB', async () => {
    await assertSucceeds(uploadBytes(ref(as(ALICE), `profilePhotos/${ALICE}/1.jpg`), image(), JPEG));
  });

  it('outro usuário não envia na pasta de alguém', async () => {
    await assertFails(uploadBytes(ref(as(BOB), `profilePhotos/${ALICE}/2.jpg`), image(), JPEG));
  });

  it('visitante não envia', async () => {
    await assertFails(uploadBytes(ref(anonymous(), `profilePhotos/${ALICE}/3.jpg`), image(), JPEG));
  });

  it('recusa arquivos que não são imagem', async () => {
    await assertFails(uploadBytes(ref(as(ALICE), `profilePhotos/${ALICE}/4.pdf`), image(), { contentType: 'application/pdf' }));
  });

  it('recusa imagens acima de 5 MB', async () => {
    await assertFails(uploadBytes(ref(as(ALICE), `profilePhotos/${ALICE}/5.jpg`), image(5 * 1024 * 1024 + 1), JPEG));
  });

  it('usuários autenticados leem; visitantes não', async () => {
    await assertSucceeds(uploadBytes(ref(as(ALICE), `profilePhotos/${ALICE}/6.jpg`), image(), JPEG));
    await assertSucceeds(getBytes(ref(as(BOB), `profilePhotos/${ALICE}/6.jpg`)));
    await assertFails(getBytes(ref(anonymous(), `profilePhotos/${ALICE}/6.jpg`)));
  });
});

describe('foto de grupo', () => {
  it('somente o proprietário (pasta com o próprio uid) envia', async () => {
    await assertSucceeds(uploadBytes(ref(as(ALICE), `groupPhotos/${ALICE}/grp1-1.jpg`), image(), JPEG));
    await assertFails(uploadBytes(ref(as(BOB), `groupPhotos/${ALICE}/grp1-2.jpg`), image(), JPEG));
  });
});

describe('demais caminhos', () => {
  it('qualquer outro caminho do Storage é negado', async () => {
    await assertFails(uploadBytes(ref(as(ALICE), 'outros/arquivo.jpg'), image(), JPEG));
    await assertFails(getBytes(ref(as(ALICE), 'outros/arquivo.jpg')));
  });
});
