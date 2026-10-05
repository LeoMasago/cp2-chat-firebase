const pad = (value: number): string => String(value).padStart(2, '0');

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** `14:05` */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Hoje → `14:05`; ontem → `Ontem`; antes → `03/10/2026`. */
export function formatConversationTime(timestamp: number, now: Date = new Date()): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isSameDay(date, now)) return formatTime(timestamp);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Ontem';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}
