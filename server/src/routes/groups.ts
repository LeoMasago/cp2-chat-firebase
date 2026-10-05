import { Router } from 'express';
import { badRequest, forbidden, notFound } from '../errors.js';
import { requireUid } from '../middleware/authenticate.js';
import type { ChatStore } from '../services/chatStore.js';
import { idSchema } from './notifications.js';

export function groupsRouter(store: ChatStore): Router {
  const router = Router();

  /**
   * POST /groups/:groupId/sync-members
   *
   * O Firestore é a fonte de verdade dos integrantes (e do limite). As regras do
   * Realtime Database não conseguem consultar o Firestore, então este endpoint
   * — chamado pelo proprietário após criar/alterar integrantes — copia a lista
   * para `groupMembers/{groupId}`, de onde as regras do RTDB lêem quem pode ler
   * e escrever as mensagens do grupo. Remover alguém do grupo revoga o acesso
   * às novas mensagens assim que a cópia é atualizada.
   */
  router.post('/:groupId/sync-members', async (request, response) => {
    const parsedId = idSchema.safeParse(request.params['groupId']);
    if (!parsedId.success) throw badRequest('Identificador de grupo inválido.');

    const group = await store.getGroup(parsedId.data);
    if (!group) throw notFound('Grupo não encontrado.');
    if (group.ownerId !== requireUid(request)) {
      throw forbidden('Somente o proprietário pode sincronizar os integrantes do grupo.');
    }
    if (group.memberIds.length > group.memberLimit) {
      throw forbidden('O grupo excede o limite de integrantes configurado.');
    }

    await store.replaceGroupMembers(group.id, group.memberIds);
    response.json({ groupId: group.id, memberCount: group.memberIds.length });
  });

  return router;
}
