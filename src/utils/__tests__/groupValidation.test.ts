import { describe, expect, it } from 'vitest';
import type { ChatGroup } from '../../types/group';
import { AppError } from '../errors';
import {
  applyGroupChanges,
  describeSlots,
  getAvailableSlots,
  parseMemberLimit,
  validateGroupName,
  validateMemberLimit,
} from '../groupValidation';

const group = (overrides: Partial<ChatGroup> = {}): ChatGroup => ({
  id: 'g1',
  name: 'Turma',
  photoUrl: '',
  ownerId: 'owner',
  memberIds: ['owner', 'a', 'b'],
  memberLimit: 5,
  notificationPolicy: 'all_group_messages',
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const codeOf = (action: () => unknown): string | undefined => {
  try {
    action();
  } catch (error) {
    return error instanceof AppError ? error.code : 'other';
  }
  return undefined;
};

describe('validateMemberLimit', () => {
  it('aceita limite válido', () => {
    expect(validateMemberLimit(5, 3)).toBeNull();
    expect(validateMemberLimit(3, 3)).toBeNull();
  });

  it('recusa valores não inteiros, fora da faixa e abaixo dos integrantes atuais', () => {
    expect(validateMemberLimit(null, 0)).not.toBeNull();
    expect(validateMemberLimit(2.5, 0)).not.toBeNull();
    expect(validateMemberLimit(1, 0)).not.toBeNull();
    expect(validateMemberLimit(51, 0)).not.toBeNull();
    expect(validateMemberLimit(4, 5)).toMatch(/quantidade atual/);
  });
});

describe('parseMemberLimit', () => {
  it('converte somente inteiros positivos', () => {
    expect(parseMemberLimit(' 12 ')).toBe(12);
    expect(parseMemberLimit('1.5')).toBeNull();
    expect(parseMemberLimit('-3')).toBeNull();
    expect(parseMemberLimit('abc')).toBeNull();
    expect(parseMemberLimit('')).toBeNull();
  });
});

describe('vagas', () => {
  it('calcula e descreve as vagas disponíveis', () => {
    expect(getAvailableSlots(3, 5)).toBe(2);
    expect(getAvailableSlots(6, 5)).toBe(0);
    expect(describeSlots(3, 5)).toBe('3/5 integrantes · 2 vagas disponíveis');
    expect(describeSlots(4, 5)).toBe('4/5 integrantes · 1 vaga disponível');
    expect(describeSlots(5, 5)).toBe('5/5 integrantes · sem vagas');
  });
});

describe('validateGroupName', () => {
  it('exige entre 3 e 60 caracteres', () => {
    expect(validateGroupName('  ab ')).not.toBeNull();
    expect(validateGroupName('Turma 3SI')).toBeNull();
    expect(validateGroupName('x'.repeat(61))).not.toBeNull();
  });
});

describe('applyGroupChanges', () => {
  it('adiciona integrantes enquanto houver vagas', () => {
    const result = applyGroupChanges(group(), 'owner', { addMemberIds: ['c', 'd'] }, 99);
    expect(result.memberIds).toEqual(['owner', 'a', 'b', 'c', 'd']);
    expect(result.updatedAt).toBe(99);
  });

  it('impede ultrapassar o limite (grupo cheio)', () => {
    expect(codeOf(() => applyGroupChanges(group(), 'owner', { addMemberIds: ['c', 'd', 'e'] }, 1))).toBe(
      'group/full',
    );
  });

  it('considera o estado atual do grupo: dois adicionadores concorrentes não passam do limite', () => {
    // Dois "dispositivos" querem entrar com 1 pessoa cada em um grupo com 1 vaga;
    // o segundo enxerga o grupo já atualizado pelo primeiro.
    const initial = group({ memberLimit: 4 });
    const afterFirst = applyGroupChanges(initial, 'owner', { addMemberIds: ['c'] }, 1);
    expect(afterFirst.memberIds).toHaveLength(4);
    expect(codeOf(() => applyGroupChanges(afterFirst, 'owner', { addMemberIds: ['d'] }, 2))).toBe('group/full');
  });

  it('não conta duas vezes quem já é integrante', () => {
    const result = applyGroupChanges(group(), 'owner', { addMemberIds: ['a', 'c'] }, 1);
    expect(result.memberIds).toEqual(['owner', 'a', 'b', 'c']);
  });

  it('não permite reduzir o limite abaixo da quantidade atual', () => {
    expect(codeOf(() => applyGroupChanges(group(), 'owner', { memberLimit: 2 }, 1))).toBe(
      'group/limit-below-members',
    );
    expect(applyGroupChanges(group(), 'owner', { memberLimit: 3 }, 1).memberLimit).toBe(3);
  });

  it('permite remover e adicionar na mesma alteração respeitando o limite final', () => {
    const result = applyGroupChanges(
      group({ memberLimit: 3 }),
      'owner',
      { removeMemberIds: ['a'], addMemberIds: ['c'] },
      1,
    );
    expect(result.memberIds).toEqual(['owner', 'b', 'c']);
  });

  it('somente o proprietário altera o grupo', () => {
    expect(codeOf(() => applyGroupChanges(group(), 'a', { name: 'Novo nome' }, 1))).toBe('group/not-owner');
  });

  it('o proprietário não pode ser removido e o grupo mantém ao menos 2 integrantes', () => {
    expect(codeOf(() => applyGroupChanges(group(), 'owner', { removeMemberIds: ['owner'] }, 1))).toBe(
      'group/cannot-remove-owner',
    );
    expect(codeOf(() => applyGroupChanges(group(), 'owner', { removeMemberIds: ['a', 'b'] }, 1))).toBe(
      'group/min-members',
    );
  });

  it('valida nome e política', () => {
    expect(codeOf(() => applyGroupChanges(group(), 'owner', { name: 'ab' }, 1))).toBe('group/invalid-name');
    const result = applyGroupChanges(group(), 'owner', { name: '  Novo Nome ', notificationPolicy: 'disabled' }, 1);
    expect(result.name).toBe('Novo Nome');
    expect(result.notificationPolicy).toBe('disabled');
  });
});
