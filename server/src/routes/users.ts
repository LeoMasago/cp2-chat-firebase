import { Router } from 'express';
import { badRequest, forbidden, notFound } from '../errors.js';
import { requireUid } from '../middleware/authenticate.js';
import type { ChatStore } from '../services/chatStore.js';
import { canViewProfile } from '../services/profileAccess.js';
import type { ProfileView } from '../types.js';
import { idSchema } from './notifications.js';

export function usersRouter(store: ChatStore): Router {
  const router = Router();

  /**
   * GET /users/:uid/profile
   * Devolve os dados cadastrais (e-mail, celular, nascimento) apenas para o
   * próprio usuário ou para quem compartilha conversa individual/grupo com ele.
   * Esses dados ficam em `users/{uid}/private/profile`, que as regras do
   * Firestore bloqueiam para qualquer outro cliente.
   */
  router.get('/:uid/profile', async (request, response) => {
    const parsedUid = idSchema.safeParse(request.params['uid']);
    if (!parsedUid.success) throw badRequest('Identificador de usuário inválido.');
    const targetUid = parsedUid.data;
    const viewerUid = requireUid(request);

    if (!(await canViewProfile(store, viewerUid, targetUid))) {
      throw forbidden('Você não compartilha uma conversa ou grupo com este usuário.');
    }

    const [publicProfile, privateProfile] = await Promise.all([
      store.getPublicProfile(targetUid),
      store.getPrivateProfile(targetUid),
    ]);
    if (!publicProfile) throw notFound('Usuário não encontrado.');

    const profile: ProfileView = {
      ...publicProfile,
      email: privateProfile?.email ?? null,
      phoneNumber: privateProfile?.phoneNumber ?? null,
      birthDate: privateProfile?.birthDate ?? null,
    };
    response.json(profile);
  });

  return router;
}
