import { describe, expect, it } from 'vitest';
import { resolveRecipientIds } from '../src/services/recipientResolver.js';
import type { MessageTarget, NotificationPolicy } from '../src/types.js';

const members = ['ana', 'bia', 'caio', 'dora'];

function group(
  policy: NotificationPolicy,
  options: { senderId?: string; target?: MessageTarget; mentionedUserIds?: string[]; memberIds?: string[] } = {},
): string[] {
  return resolveRecipientIds({
    conversationType: 'group',
    senderId: options.senderId ?? 'ana',
    memberIds: options.memberIds ?? members,
    policy,
    target: options.target ?? { type: 'conversation' },
    mentionedUserIds: options.mentionedUserIds ?? [],
  });
}

describe('resolveRecipientIds — conversa individual', () => {
  it('notifica apenas o outro participante', () => {
    expect(
      resolveRecipientIds({ conversationType: 'direct', senderId: 'ana', participantIds: ['ana', 'bia'] }),
    ).toEqual(['bia']);
  });

  it('não notifica ninguém quando o remetente não participa', () => {
    expect(
      resolveRecipientIds({ conversationType: 'direct', senderId: 'caio', participantIds: ['ana', 'bia'] }),
    ).toEqual([]);
  });

  it('não notifica conversa consigo mesmo', () => {
    expect(
      resolveRecipientIds({ conversationType: 'direct', senderId: 'ana', participantIds: ['ana', 'ana'] }),
    ).toEqual([]);
  });
});

describe('resolveRecipientIds — all_group_messages', () => {
  it('notifica todos os integrantes, exceto o remetente', () => {
    expect(group('all_group_messages')).toEqual(['bia', 'caio', 'dora']);
  });

  it('notifica todos também quando a mensagem é direcionada a um integrante', () => {
    expect(group('all_group_messages', { target: { type: 'member', memberId: 'bia' } })).toEqual([
      'bia',
      'caio',
      'dora',
    ]);
  });

  it('ignora remetente que não é integrante (removido do grupo)', () => {
    expect(group('all_group_messages', { senderId: 'intruso' })).toEqual([]);
  });
});

describe('resolveRecipientIds — mentioned_members', () => {
  it('não notifica ninguém quando a mensagem é geral e sem menções', () => {
    expect(group('mentioned_members')).toEqual([]);
  });

  it('notifica o integrante selecionado como destinatário', () => {
    expect(group('mentioned_members', { target: { type: 'member', memberId: 'caio' } })).toEqual(['caio']);
  });

  it('notifica os mencionados, sem duplicar quem também é o destinatário', () => {
    expect(
      group('mentioned_members', {
        target: { type: 'member', memberId: 'bia' },
        mentionedUserIds: ['bia', 'dora'],
      }),
    ).toEqual(['bia', 'dora']);
  });

  it('não notifica o remetente mesmo que ele se mencione', () => {
    expect(group('mentioned_members', { mentionedUserIds: ['ana', 'bia'] })).toEqual(['bia']);
  });

  it('descarta menções a quem não é integrante do grupo', () => {
    expect(group('mentioned_members', { mentionedUserIds: ['fantasma', 'bia'] })).toEqual(['bia']);
  });
});

describe('resolveRecipientIds — direct_messages_only e disabled', () => {
  it.each<NotificationPolicy>(['direct_messages_only', 'disabled'])(
    '%s nunca gera push em grupos, nem com menção',
    (policy) => {
      expect(
        group(policy, { target: { type: 'member', memberId: 'bia' }, mentionedUserIds: ['caio'] }),
      ).toEqual([]);
    },
  );
});
