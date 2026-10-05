/**
 * Erros de domínio e tradução de erros técnicos (Firebase, API, rede) em
 * mensagens compreensíveis, sem expor detalhes internos ou credenciais.
 */

export type AppErrorCode =
  | 'auth/no-session'
  | 'auth/profile-missing'
  | 'group/not-found'
  | 'group/not-owner'
  | 'group/full'
  | 'group/limit-below-members'
  | 'group/invalid-limit'
  | 'group/invalid-name'
  | 'group/min-members'
  | 'group/cannot-remove-owner'
  | 'group/sync-failed'
  | 'chat/self-conversation'
  | 'chat/empty-message'
  | 'chat/conversation-unavailable'
  | 'image/permission-denied'
  | 'image/upload-failed'
  | 'config/missing';

/** Erro de regra de negócio, cuja mensagem já é segura e amigável para exibir. */
export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

/** Erro devolvido pela API de notificações (`status` 0 = sem resposta de rede). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Lê o `code` de erros do Firebase (`auth/...`, `permission-denied`, `PERMISSION_DENIED`...). */
export function getErrorCode(error: unknown): string | null {
  if (isRecord(error) && typeof error['code'] === 'string') return error['code'];
  return null;
}

const normalize = (code: string): string => code.toLowerCase().replace(/[^a-z]/g, '');

export function isPermissionDenied(error: unknown): boolean {
  if (error instanceof ApiError) return error.status === 403;
  const code = getErrorCode(error);
  if (code && normalize(code).includes('permissiondenied')) return true;
  return error instanceof Error && /permission[_ ]denied/i.test(error.message);
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof ApiError) return error.status === 0;
  const code = getErrorCode(error);
  if (code) {
    const normalized = normalize(code);
    if (normalized.includes('networkrequestfailed') || normalized.includes('unavailable')) return true;
  }
  return error instanceof TypeError && /network request failed|failed to fetch/i.test(error.message);
}

const FIREBASE_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/invalid-login-credentials': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'Informe um e-mail válido.',
  'auth/email-already-in-use': 'Este e-mail já está cadastrado. Tente entrar.',
  'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  'auth/missing-password': 'Informe a senha.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'auth/user-token-expired': 'Sua sessão expirou. Entre novamente.',
  'auth/requires-recent-login': 'Sua sessão expirou. Entre novamente.',
  'auth/operation-not-allowed':
    'O login por e-mail e senha não está habilitado no projeto Firebase.',
  'auth/network-request-failed': 'Sem conexão com a internet. Verifique sua rede e tente novamente.',
  'auth/api-key-not-valid': 'Configuração do Firebase inválida. Confira o arquivo firebaseConfig.json.',
  'auth/invalid-api-key': 'Configuração do Firebase inválida. Confira o arquivo firebaseConfig.json.',
};

const GENERIC_MESSAGE = 'Ocorreu um erro inesperado. Tente novamente.';

export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;

  if (error instanceof ApiError) {
    if (error.status === 0) return 'Não foi possível conectar ao servidor. Verifique sua internet.';
    if (error.status === 401) return 'Sua sessão expirou. Entre novamente.';
    if (error.status === 403) return 'Você não tem permissão para realizar esta ação.';
    if (error.status === 404) return 'O item solicitado não foi encontrado.';
    if (error.status === 429) return 'Muitas requisições. Aguarde um instante e tente novamente.';
    return 'O servidor está indisponível no momento. Tente novamente em instantes.';
  }

  const code = getErrorCode(error);
  if (code && FIREBASE_MESSAGES[code]) return FIREBASE_MESSAGES[code];

  if (isPermissionDenied(error)) return 'Você não tem permissão para realizar esta ação.';
  if (isNetworkError(error)) return 'Sem conexão com a internet. Verifique sua rede e tente novamente.';

  if (code) {
    const normalized = normalize(code);
    if (normalized.includes('notfound')) return 'O item solicitado não foi encontrado.';
    if (normalized.includes('aborted') || normalized.includes('failedprecondition')) {
      return 'Os dados foram alterados por outra pessoa. Tente novamente.';
    }
    if (normalized.includes('deadlineexceeded')) return 'A operação demorou demais. Tente novamente.';
    if (normalized.includes('storage') || normalized.includes('retrylimit')) {
      return 'Não foi possível enviar a imagem. Tente novamente.';
    }
    if (normalized.includes('resourceexhausted') || normalized.includes('quota')) {
      return 'Limite de uso do serviço atingido. Tente mais tarde.';
    }
  }
  return GENERIC_MESSAGE;
}
