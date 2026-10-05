import express, { type ErrorRequestHandler, type Express } from 'express';
import helmet from 'helmet';
import { HttpError } from './errors.js';
import { authenticate, type TokenVerifier } from './middleware/authenticate.js';
import { devicesRouter } from './routes/devices.js';
import { groupsRouter } from './routes/groups.js';
import { notificationsRouter } from './routes/notifications.js';
import { usersRouter } from './routes/users.js';
import type { ChatStore } from './services/chatStore.js';
import type { PushSender } from './services/notificationSender.js';

export type AppDependencies = {
  auth: TokenVerifier;
  store: ChatStore;
  push: PushSender;
  includePreview: boolean;
  trustProxy: number;
  version: string;
};

const BODY_LIMIT = '10kb';

export function createApp(dependencies: AppDependencies): Express {
  const { auth, store, push, includePreview, trustProxy, version } = dependencies;
  const app = express();
  const startedAt = Date.now();

  app.set('trust proxy', trustProxy);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: BODY_LIMIT }));

  // Health check público: usado para verificar a disponibilidade da API publicada.
  app.get('/health', (_request, response) => {
    response.json({
      status: 'ok',
      service: 'cp2-chat-api',
      version,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    });
  });

  // Todo o resto exige um Firebase ID Token válido.
  const requireAuth = authenticate(auth);
  app.use('/notifications', requireAuth, notificationsRouter({ store, push, includePreview }));
  app.use('/users', requireAuth, usersRouter(store));
  app.use('/groups', requireAuth, groupsRouter(store));
  app.use('/devices', requireAuth, devicesRouter(store));

  app.use((_request, response) => {
    response.status(404).json({ error: { code: 'not_found', message: 'Rota não encontrada.' } });
  });

  const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (error instanceof HttpError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    const isBadJson = error instanceof SyntaxError && 'body' in error;
    if (isBadJson) {
      response.status(400).json({ error: { code: 'bad_request', message: 'JSON inválido.' } });
      return;
    }
    // Detalhes internos ficam apenas no log do servidor.
    console.error('Erro não tratado:', error);
    response
      .status(500)
      .json({ error: { code: 'internal_error', message: 'Erro interno. Tente novamente.' } });
  };
  app.use(errorHandler);

  return app;
}
