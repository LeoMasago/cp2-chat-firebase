import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (file: string): string => fileURLToPath(new URL(`../${file}`, import.meta.url));

/** Ambiente de teste com as regras REAIS do repositório carregadas nos emuladores. */
export function createTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: 'demo-cp2',
    firestore: { rules: readFileSync(root('firestore.rules'), 'utf8') },
    database: { rules: readFileSync(root('database.rules.json'), 'utf8') },
    storage: { rules: readFileSync(root('storage.rules'), 'utf8') },
  });
}

/** Os uids do Firebase têm 28 caracteres alfanuméricos; os de teste seguem o mesmo formato. */
export const uid = (name: string): string => name.padEnd(28, 'x');

/** Ids de grupo são ids automáticos do Firestore: 20 caracteres alfanuméricos. */
export const groupId = (name: string): string => `grp${name}`.padEnd(20, '0');

export const directId = (a: string, b: string): string => (a < b ? `${a}_${b}` : `${b}_${a}`);

export const ALICE = uid('alice');
export const BOB = uid('bob');
export const CAROL = uid('carol');
export const DAVE = uid('dave');
