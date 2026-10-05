import type { MessageTarget, NotificationPolicy } from '../types.js';

type DirectInput = {
  conversationType: 'direct';
  senderId: string;
  participantIds: readonly string[];
};

type GroupInput = {
  conversationType: 'group';
  senderId: string;
  memberIds: readonly string[];
  policy: NotificationPolicy;
  target: MessageTarget;
  mentionedUserIds: readonly string[];
};

export type RecipientInput = DirectInput | GroupInput;

/**
 * Calcula, no servidor, quem deve receber o push de uma mensagem.
 *
 * Regras (ver README, "Política de notificações"):
 *  - o remetente nunca é destinatário da própria mensagem;
 *  - só participantes da conversa podem ser destinatários;
 *  - conversa individual: sempre notifica o outro participante;
 *  - grupo `all_group_messages`: todos os integrantes (menos o remetente);
 *  - grupo `mentioned_members`: só quem foi selecionado como destinatário
 *    (`target.memberId`) ou mencionado (`mentionedUserIds`);
 *  - grupo `direct_messages_only` e `disabled`: ninguém.
 *
 * A lista nunca vem do app: ela é derivada do Firestore + Realtime Database.
 */
export function resolveRecipientIds(input: RecipientInput): string[] {
  if (input.conversationType === 'direct') {
    const participants = new Set(input.participantIds);
    if (participants.size !== 2 || !participants.has(input.senderId)) return [];
    return [...participants].filter((uid) => uid !== input.senderId);
  }

  const members = new Set(input.memberIds);
  if (!members.has(input.senderId)) return [];

  switch (input.policy) {
    case 'all_group_messages':
      return [...members].filter((uid) => uid !== input.senderId);
    case 'mentioned_members': {
      const explicit = new Set<string>(input.mentionedUserIds);
      if (input.target.type === 'member') explicit.add(input.target.memberId);
      return [...explicit].filter((uid) => uid !== input.senderId && members.has(uid));
    }
    case 'direct_messages_only':
    case 'disabled':
      return [];
  }
}
