import { API_URL, isApiConfigured } from '../config/env';
import type { ProfileView } from '../types/user';
import { ApiError, AppError } from '../utils/errors';
import { auth } from './firebase';

const REQUEST_TIMEOUT_MS = 15_000;

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: Record<string, string>;
  /** Tentativas extras em falhas de rede/5xx (seguro apenas para operações idempotentes). */
  retries?: number;
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function requestOnce<T>(path: string, options: RequestOptions): Promise<T> {
  if (!isApiConfigured) {
    throw new AppError('config/missing', 'A URL da API não foi configurada (EXPO_PUBLIC_API_URL).');
  }
  const currentUser = auth.currentUser;
  if (!currentUser) throw new AppError('auth/no-session', 'Sua sessão expirou. Entre novamente.');

  // O SDK renova o ID token automaticamente quando ele está perto de expirar.
  const idToken = await currentUser.getIdToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const payload = await parseJson(response);
    if (!response.ok) {
      const details = isRecord(payload) && isRecord(payload['error']) ? payload['error'] : null;
      const code = details && typeof details['code'] === 'string' ? details['code'] : 'http_error';
      const message = details && typeof details['message'] === 'string' ? details['message'] : response.statusText;
      throw new ApiError(response.status, code, message);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // Sem resposta: rede indisponível ou tempo esgotado.
    throw new ApiError(0, 'network_error', 'Falha de conexão com a API.');
  } finally {
    clearTimeout(timer);
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const attempts = (options.retries ?? 0) + 1;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await requestOnce<T>(path, options);
    } catch (error) {
      lastError = error;
      const retryable = error instanceof ApiError && (error.status === 0 || error.status >= 500);
      if (!retryable || attempt === attempts) break;
      await wait(attempt * 1_000);
    }
  }
  throw lastError;
}

export type NotifyResult = {
  status: 'sent' | 'duplicate' | 'expired' | 'no_recipients' | 'no_devices';
  recipients: number;
  devices: number;
  sent: number;
  failed: number;
  removedTokens: number;
};

/**
 * Endpoints da API própria (ver `server/`). O app nunca envia push diretamente:
 * apenas informa qual mensagem acabou de salvar; os destinatários são calculados no servidor.
 */
export const apiClient = {
  /** POST /notifications/messages — idempotente, por isso pode ser repetido com segurança. */
  notifyMessage(conversationId: string, messageId: string): Promise<NotifyResult> {
    return request<NotifyResult>('/notifications/messages', {
      method: 'POST',
      body: { conversationId, messageId },
      retries: 2,
    });
  },

  /** GET /users/:uid/profile — dados cadastrais de quem compartilha conversa ou grupo com você. */
  getProfile(uid: string): Promise<ProfileView> {
    return request<ProfileView>(`/users/${encodeURIComponent(uid)}/profile`, { retries: 1 });
  },

  /** POST /groups/:id/sync-members — espelha os integrantes do Firestore no Realtime Database. */
  async syncGroupMembers(groupId: string): Promise<void> {
    await request<{ memberCount: number }>(`/groups/${encodeURIComponent(groupId)}/sync-members`, {
      method: 'POST',
      body: {},
      retries: 2,
    });
  },

  /** POST /devices/claim — remove o mesmo token de outros usuários no aparelho. */
  async claimDevice(deviceId: string): Promise<void> {
    await request<{ released: number }>('/devices/claim', { method: 'POST', body: { deviceId } });
  },
};
