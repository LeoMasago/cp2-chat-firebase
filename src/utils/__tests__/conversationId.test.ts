import { describe, expect, it } from 'vitest';
import { getDirectConversationId, getDirectParticipants, getOtherParticipantId } from '../conversationId';
import { AppError } from '../errors';

describe('getDirectConversationId', () => {
  it('gera o mesmo id independentemente de quem inicia a conversa', () => {
    expect(getDirectConversationId('uidB', 'uidA')).toBe('uidA_uidB');
    expect(getDirectConversationId('uidA', 'uidB')).toBe('uidA_uidB');
  });

  it('impede conversa consigo mesmo', () => {
    expect(() => getDirectConversationId('uidA', 'uidA')).toThrow(AppError);
  });
});

describe('getDirectParticipants', () => {
  it('ordena os participantes como no identificador', () => {
    expect(getDirectParticipants('uidB', 'uidA')).toEqual(['uidA', 'uidB']);
  });
});

describe('getOtherParticipantId', () => {
  it('devolve o outro participante', () => {
    expect(getOtherParticipantId('uidA_uidB', 'uidA')).toBe('uidB');
    expect(getOtherParticipantId('uidA_uidB', 'uidB')).toBe('uidA');
  });

  it('devolve null quando o usuário não participa ou o id é inválido', () => {
    expect(getOtherParticipantId('uidA_uidB', 'uidC')).toBeNull();
    expect(getOtherParticipantId('semSeparador', 'uidA')).toBeNull();
    expect(getOtherParticipantId('a_b_c', 'a')).toBeNull();
  });
});
