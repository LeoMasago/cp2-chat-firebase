export type MentionableMember = { uid: string; name: string };

/**
 * Descobre quem foi mencionado com `@Nome` no texto.
 *
 * Os nomes mais longos são testados primeiro e o trecho encontrado é removido do
 * texto restante, de modo que "@Ana Souza" não conta também como menção a "Ana".
 */
export function extractMentionedUserIds(
  text: string,
  members: readonly MentionableMember[],
  excludeUid?: string,
): string[] {
  const candidates = members
    .filter((member) => member.uid !== excludeUid && member.name.trim().length > 0)
    .sort((a, b) => b.name.length - a.name.length);

  let remaining = text.toLowerCase();
  const mentioned: string[] = [];
  for (const member of candidates) {
    const token = `@${member.name.trim().toLowerCase()}`;
    const index = remaining.indexOf(token);
    if (index === -1) continue;
    mentioned.push(member.uid);
    remaining = `${remaining.slice(0, index)}${' '.repeat(token.length)}${remaining.slice(index + token.length)}`;
  }
  return mentioned;
}

/** Acrescenta `@Nome ` ao final do texto, respeitando espaços já existentes. */
export function appendMention(text: string, name: string): string {
  const separator = text.length === 0 || /\s$/.test(text) ? '' : ' ';
  return `${text}${separator}@${name.trim()} `;
}
