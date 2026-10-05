import { describe, expect, it } from 'vitest';
import {
  formatBirthDate,
  maskBirthDate,
  maskPhone,
  parseBirthDate,
  validateBirthDate,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validatePhone,
} from '../validation';

describe('validateEmail', () => {
  it('valida o formato', () => {
    expect(validateEmail('ana@exemplo.com')).toBeNull();
    expect(validateEmail('ana@exemplo')).not.toBeNull();
    expect(validateEmail('')).not.toBeNull();
  });
});

describe('senha', () => {
  it('exige 6 caracteres e confirmação igual', () => {
    expect(validatePassword('12345')).not.toBeNull();
    expect(validatePassword('123456')).toBeNull();
    expect(validatePasswordConfirmation('123456', '1234567')).toBe('As senhas não conferem.');
    expect(validatePasswordConfirmation('123456', '123456')).toBeNull();
  });
});

describe('telefone', () => {
  it('aplica a máscara enquanto digita', () => {
    expect(maskPhone('11')).toBe('(11');
    expect(maskPhone('119123')).toBe('(11) 9123');
    expect(maskPhone('11912345678')).toBe('(11) 91234-5678');
    expect(maskPhone('1134567890')).toBe('(11) 3456-7890');
  });

  it('valida a quantidade de dígitos', () => {
    expect(validatePhone('(11) 91234-5678')).toBeNull();
    expect(validatePhone('(11) 1234')).not.toBeNull();
  });
});

describe('data de nascimento', () => {
  it('aplica a máscara', () => {
    expect(maskBirthDate('10052000')).toBe('10/05/2000');
    expect(maskBirthDate('1005')).toBe('10/05');
  });

  it('converte para ISO e recusa datas inexistentes', () => {
    expect(parseBirthDate('10/05/2000')).toBe('2000-05-10');
    expect(parseBirthDate('31/02/2000')).toBeNull();
    expect(parseBirthDate('29/02/2001')).toBeNull();
    expect(parseBirthDate('29/02/2000')).toBe('2000-02-29');
  });

  it('recusa datas futuras e muito antigas', () => {
    const today = new Date(2026, 9, 3);
    expect(validateBirthDate('03/10/2026', today)).toBeNull();
    expect(validateBirthDate('04/10/2026', today)).toMatch(/futuro/);
    expect(validateBirthDate('01/01/1800', today)).not.toBeNull();
  });

  it('formata o ISO para exibição', () => {
    expect(formatBirthDate('2000-05-10')).toBe('10/05/2000');
    expect(formatBirthDate('texto')).toBe('texto');
  });
});
