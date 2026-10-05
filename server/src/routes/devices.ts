import { Router } from 'express';
import { z } from 'zod';
import { badRequest } from '../errors.js';
import { requireUid } from '../middleware/authenticate.js';
import type { ChatStore } from '../services/chatStore.js';
import { idSchema } from './notifications.js';

const bodySchema = z.object({ deviceId: idSchema });

export function devicesRouter(store: ChatStore): Router {
  const router = Router();

  /**
   * POST /devices/claim
   * Chamado pelo app logo após registrar o token em `users/{uid}/devices/{deviceId}`.
   * Remove o mesmo token de qualquer outro usuário, para que as notificações de
   * quem usou o aparelho antes não cheguem ao usuário atual.
   */
  router.post('/claim', async (request, response) => {
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) throw badRequest('Informe um deviceId válido.');
    const released = await store.releaseDeviceToken(requireUid(request), parsed.data.deviceId);
    response.json({ released });
  });

  return router;
}
