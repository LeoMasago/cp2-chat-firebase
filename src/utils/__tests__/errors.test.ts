import { describe, expect, it } from 'vitest';
import { ApiError, AppError, getErrorMessage, isNetworkError, isPermissionDenied } from '../errors';

describe('getErrorMessage', () => {
  it('traduz erros de autenticação do Firebase', () => {
    expect(getErrorMessage({ code: 'auth/invalid-credential' })).toBe('E-mail ou senha incorretos.');
    expect(getErrorMessage({ code: 'auth/email-already-in-use' })).toMatch(/já está cadastrado/);
  });

  it('usa a mensagem de erros de negócio', () => {
    expect(getErrorMessage(new AppError('group/full', 'Grupo cheio.'))).toBe('Grupo cheio.');
  });

  it('traduz erros da API pelo status', () => {
    expect(getErrorMessage(new ApiError(0, 'network', 'x'))).toMatch(/conectar ao servidor/);
    expect(getErrorMessage(new ApiError(401, 'unauthorized', 'x'))).toMatch(/sessão expirou/);
    expect(getErrorMessage(new ApiError(503, 'x', 'detalhe interno'))).not.toMatch(/detalhe interno/);
  });

  it('não vaza detalhes internos de erros desconhecidos', () => {
    expect(getErrorMessage(new Error('stack secreto /srv/app'))).toBe(
      'Ocorreu um erro inesperado. Tente novamente.',
    );
  });
});

describe('detecção de tipos de erro', () => {
  it('reconhece permissão negada do Firestore e do Realtime Database', () => {
    expect(isPermissionDenied({ code: 'permission-denied' })).toBe(true);
    expect(isPermissionDenied({ code: 'PERMISSION_DENIED' })).toBe(true);
    expect(isPermissionDenied(new Error('permission_denied at /messages'))).toBe(true);
    expect(isPermissionDenied(new Error('outro'))).toBe(false);
  });

  it('reconhece falhas de rede', () => {
    expect(isNetworkError({ code: 'auth/network-request-failed' })).toBe(true);
    expect(isNetworkError({ code: 'unavailable' })).toBe(true);
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
    expect(isNetworkError(new Error('x'))).toBe(false);
  });
});
