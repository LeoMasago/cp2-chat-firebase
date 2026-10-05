import {
  MAX_GROUP_NAME_LENGTH,
  MAX_MEMBER_LIMIT,
  MIN_GROUP_MEMBERS,
  MIN_GROUP_NAME_LENGTH,
  type ChatGroup,
  type GroupChanges,
} from '../types/group';
import { AppError } from './errors';

/** Mensagem de erro de um campo, ou `null` quando válido. */
export type FieldError = string | null;

export function validateGroupName(name: string): FieldError {
  const trimmed = name.trim();
  if (trimmed.length < MIN_GROUP_NAME_LENGTH) {
    return `O nome do grupo precisa ter pelo menos ${MIN_GROUP_NAME_LENGTH} caracteres.`;
  }
  if (trimmed.length > MAX_GROUP_NAME_LENGTH) {
    return `O nome do grupo pode ter no máximo ${MAX_GROUP_NAME_LENGTH} caracteres.`;
  }
  return null;
}

/** Converte o texto digitado em inteiro; `null` se não for um número inteiro válido. */
export function parseMemberLimit(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * Valida o limite de integrantes: inteiro, entre o mínimo do grupo e o máximo
 * permitido, e nunca menor que a quantidade atual de integrantes.
 */
export function validateMemberLimit(limit: number | null, currentMemberCount: number): FieldError {
  if (limit === null || !Number.isInteger(limit)) return 'Informe um número inteiro para o limite.';
  if (limit < MIN_GROUP_MEMBERS) return `O limite mínimo é ${MIN_GROUP_MEMBERS} integrantes.`;
  if (limit > MAX_MEMBER_LIMIT) return `O limite máximo é ${MAX_MEMBER_LIMIT} integrantes.`;
  if (limit < currentMemberCount) {
    return `O limite não pode ser menor que a quantidade atual de integrantes (${currentMemberCount}).`;
  }
  return null;
}

/** Vagas ainda disponíveis (nunca negativo). */
export function getAvailableSlots(memberCount: number, memberLimit: number): number {
  return Math.max(memberLimit - memberCount, 0);
}

export function describeSlots(memberCount: number, memberLimit: number): string {
  const slots = getAvailableSlots(memberCount, memberLimit);
  if (slots === 0) return `${memberCount}/${memberLimit} integrantes · sem vagas`;
  return `${memberCount}/${memberLimit} integrantes · ${slots} ${slots === 1 ? 'vaga disponível' : 'vagas disponíveis'}`;
}

const unique = (ids: readonly string[]): string[] => [...new Set(ids)];

/**
 * Calcula o grupo resultante de uma alteração, validando todas as regras de negócio.
 *
 * Roda dentro da transação do Firestore sobre o documento *atual*; por isso, se
 * outra pessoa alterou os integrantes depois que a tela foi aberta, a validação
 * do limite considera o estado real. As regras de segurança do Firestore
 * repetem a verificação no servidor.
 */
export function applyGroupChanges(
  current: ChatGroup,
  actorId: string,
  changes: GroupChanges,
  now: number,
): ChatGroup {
  if (current.ownerId !== actorId) {
    throw new AppError('group/not-owner', 'Somente o proprietário pode alterar o grupo.');
  }

  const removeIds = unique(changes.removeMemberIds ?? []);
  if (removeIds.includes(current.ownerId)) {
    throw new AppError('group/cannot-remove-owner', 'O proprietário não pode ser removido do grupo.');
  }
  const remaining = current.memberIds.filter((id) => !removeIds.includes(id));
  const memberIds = unique([...remaining, ...(changes.addMemberIds ?? [])]);

  const memberLimit = changes.memberLimit ?? current.memberLimit;
  const limitError = validateMemberLimit(memberLimit, 0);
  if (limitError) throw new AppError('group/invalid-limit', limitError);

  if (memberIds.length < MIN_GROUP_MEMBERS) {
    throw new AppError('group/min-members', `Um grupo precisa ter pelo menos ${MIN_GROUP_MEMBERS} integrantes.`);
  }
  if (memberIds.length > memberLimit) {
    const reducingLimit = changes.memberLimit !== undefined && changes.memberLimit < current.memberLimit;
    throw reducingLimit
      ? new AppError(
          'group/limit-below-members',
          `O limite não pode ser menor que a quantidade atual de integrantes (${memberIds.length}).`,
        )
      : new AppError('group/full', 'O grupo atingiu o limite de integrantes e não há vagas disponíveis.');
  }

  if (changes.name !== undefined) {
    const nameError = validateGroupName(changes.name);
    if (nameError) throw new AppError('group/invalid-name', nameError);
  }

  return {
    ...current,
    name: changes.name !== undefined ? changes.name.trim() : current.name,
    photoUrl: changes.photoUrl ?? current.photoUrl,
    memberIds,
    memberLimit,
    notificationPolicy: changes.notificationPolicy ?? current.notificationPolicy,
    updatedAt: now,
  };
}
