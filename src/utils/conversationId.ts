import { AppError } from './errors';

/**
 * Identificador da conversa individual: os dois `uid` ordenados e unidos por `_`.
 * Como a ordem não depende de quem inicia a conversa, existe exatamente uma
 * conversa para cada par de usuários.
 */
export function getDirectConversationId(firstUid: string, secondUid: string): string {
  if (firstUid === secondUid) {
    throw new AppError('chat/self-conversation', 'Você não pode iniciar uma conversa consigo mesmo.');
  }
  return firstUid < secondUid ? `${firstUid}_${secondUid}` : `${secondUid}_${firstUid}`;
}

/** Os dois participantes, na mesma ordem usada no identificador. */
export function getDirectParticipants(firstUid: string, secondUid: string): [string, string] {
  getDirectConversationId(firstUid, secondUid);
  return firstUid < secondUid ? [firstUid, secondUid] : [secondUid, firstUid];
}

/** Extrai o `uid` do outro participante de uma conversa individual, ou `null` se `uid` não participa. */
export function getOtherParticipantId(conversationId: string, uid: string): string | null {
  const [first, second, ...rest] = conversationId.split('_');
  if (!first || !second || rest.length > 0) return null;
  if (first === uid) return second;
  if (second === uid) return first;
  return null;
}
