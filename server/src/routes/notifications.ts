import { Router } from 'express';
import { z } from 'zod';
import { badRequest } from '../errors.js';
import { requireUid } from '../middleware/authenticate.js';
import { notifyMessage, type NotifierOptions } from '../services/messageNotifier.js';

/** Identificadores do Firebase: letras, números, `_` e `-` (nunca `/`, `.`, `#`, `$`, `[`, `]`). */
export const idSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/, 'Identificador inválido.');

const bodySchema = z.object({
  conversationId: idSchema,
  messageId: idSchema,
});

export function notificationsRouter(options: NotifierOptions): Router {
  const router = Router();

  /**
   * POST /notifications/messages
   * Authorization: Bearer <firebase-id-token>
   * { "conversationId": "...", "messageId": "..." }
   *
   * O app informa apenas qual mensagem acabou de salvar. Os destinatários são
   * calculados aqui, a partir do Firestore e do Realtime Database.
   */
  router.post('/messages', async (request, response) => {
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) throw badRequest('Informe conversationId e messageId válidos.');

    const outcome = await notifyMessage(options, {
      uid: requireUid(request),
      conversationId: parsed.data.conversationId,
      messageId: parsed.data.messageId,
    });
    response.json(outcome);
  });

  return router;
}
