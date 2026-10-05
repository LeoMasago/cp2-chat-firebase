import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { unauthorized } from '../errors.js';

export interface TokenVerifier {
  /** Valida o ID token do Firebase Authentication e devolve o `uid`. */
  verifyIdToken(idToken: string): Promise<{ uid: string }>;
}

declare module 'express-serve-static-core' {
  interface Request {
    /** `uid` do usuário autenticado (definido por `authenticate`). */
    uid?: string;
  }
}

/** Retorna o `uid` autenticado de uma requisição já processada por `authenticate`. */
export function requireUid(request: Request): string {
  if (!request.uid) throw unauthorized('Autenticação necessária.');
  return request.uid;
}

/**
 * Exige `Authorization: Bearer <firebase-id-token>` e valida o token com o
 * Firebase Admin SDK. O `uid` vem sempre do token — nunca do corpo da requisição.
 */
export function authenticate(verifier: TokenVerifier): RequestHandler {
  return async (request: Request, _response: Response, next: NextFunction) => {
    const header = request.header('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw unauthorized('Informe o token no cabeçalho Authorization: Bearer.');
    }
    try {
      const decoded = await verifier.verifyIdToken(token);
      request.uid = decoded.uid;
    } catch {
      throw unauthorized('Sessão inválida ou expirada. Entre novamente.');
    }
    next();
  };
}
