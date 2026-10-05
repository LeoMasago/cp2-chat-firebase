import type { FieldError } from './groupValidation';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MIN_PASSWORD_LENGTH = 6;

export const onlyDigits = (value: string): string => value.replace(/\D/g, '');

export function validateEmail(email: string): FieldError {
  const trimmed = email.trim();
  if (!trimmed) return 'Informe seu e-mail.';
  if (!EMAIL_PATTERN.test(trimmed)) return 'Informe um e-mail válido.';
  return null;
}

export function validatePassword(password: string): FieldError {
  if (!password) return 'Informe a senha.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  return null;
}

export function validatePasswordConfirmation(password: string, confirmation: string): FieldError {
  if (!confirmation) return 'Confirme a senha.';
  if (password !== confirmation) return 'As senhas não conferem.';
  return null;
}

export function validateName(name: string): FieldError {
  const trimmed = name.trim();
  if (trimmed.length < 2) return 'Informe seu nome.';
  if (trimmed.length > 80) return 'O nome pode ter no máximo 80 caracteres.';
  return null;
}

/** Celular brasileiro: DDD + 9 dígitos (11) — aceita também fixo com 10 dígitos. */
export function validatePhone(phone: string): FieldError {
  const digits = onlyDigits(phone);
  if (!digits) return 'Informe seu número de celular.';
  if (digits.length < 10 || digits.length > 11) return 'Informe o celular com DDD (10 ou 11 dígitos).';
  return null;
}

/** `11912345678` → `(11) 91234-5678`, formatando enquanto o usuário digita. */
export function maskPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** `10052000` → `10/05/2000`. */
export function maskBirthDate(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Converte `DD/MM/AAAA` em ISO `AAAA-MM-DD`; `null` se for uma data inexistente. */
export function parseBirthDate(display: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display.trim());
  if (!match) return null;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isRealDate ? `${yearText}-${monthText}-${dayText}` : null;
}

export function validateBirthDate(display: string, today: Date = new Date()): FieldError {
  if (!display.trim()) return 'Informe sua data de nascimento.';
  const iso = parseBirthDate(display);
  if (!iso) return 'Informe uma data válida no formato DD/MM/AAAA.';
  const year = Number(iso.slice(0, 4));
  if (year < 1900) return 'Informe uma data de nascimento válida.';
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (iso > todayIso) return 'A data de nascimento não pode estar no futuro.';
  return null;
}

/** ISO `AAAA-MM-DD` → `DD/MM/AAAA`; devolve o texto original se não estiver no formato esperado. */
export function formatBirthDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

/** `11912345678` → `(11) 91234-5678` para exibição. */
export function formatPhone(digits: string): string {
  return maskPhone(digits);
}
