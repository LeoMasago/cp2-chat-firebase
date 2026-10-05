import type { ChatStore } from './chatStore.js';

/** Mesmo algoritmo do app (`src/utils/conversationId.ts`): uids ordenados unidos por `_`. */
export function directConversationId(firstUid: string, secondUid: string): string {
  return firstUid < secondUid ? `${firstUid}_${secondUid}` : `${secondUid}_${firstUid}`;
}

/**
 * Um usuário só pode ver os dados cadastrais de outro se ambos compartilham
 * uma conversa individual ou pelo menos um grupo (ou se for o próprio perfil).
 */
export async function canViewProfile(
  store: ChatStore,
  viewerUid: string,
  targetUid: string,
): Promise<boolean> {
  if (viewerUid === targetUid) return true;

  const direct = await store.getDirectConversation(directConversationId(viewerUid, targetUid));
  if (direct && direct.participantIds.includes(viewerUid) && direct.participantIds.includes(targetUid)) {
    return true;
  }

  const groups = await store.listGroupsOfUser(viewerUid);
  return groups.some((group) => group.memberIds.includes(targetUid));
}
