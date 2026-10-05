export type ConversationType = 'direct' | 'group';

export type DirectConversation = {
  id: string;
  type: 'direct';
  participantIds: [string, string];
  createdAt: number;
};

export type MessageTarget =
  | { type: 'conversation' }
  | { type: 'member'; memberId: string };

export type ChatMessage = {
  id: string;
  conversationId: string;
  conversationType: ConversationType;
  senderId: string;
  text: string;
  target: MessageTarget;
  mentionedUserIds: string[];
  createdAt: number;
};

/** Dados que o app informa ao enviar; `id`, `senderId` e data são definidos pelo serviço. */
export type OutgoingMessage = {
  text: string;
  target: MessageTarget;
  mentionedUserIds: string[];
};

export type LastMessage = {
  text: string;
  senderId: string;
  createdAt: number;
};

/** Item da lista de conversas (individual ou grupo) já pronto para exibição. */
export type ConversationSummary = {
  id: string;
  type: ConversationType;
  title: string;
  photoUrl: string;
  /** Para conversas individuais, o `uid` do outro participante. */
  peerId: string | null;
  lastMessage: LastMessage | null;
  /** Critério de ordenação: última mensagem, senão data de criação/atualização. */
  sortKey: number;
};
