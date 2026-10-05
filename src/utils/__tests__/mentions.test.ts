import { describe, expect, it } from 'vitest';
import { appendMention, extractMentionedUserIds } from '../mentions';

const members = [
  { uid: 'u1', name: 'Ana' },
  { uid: 'u2', name: 'Ana Souza' },
  { uid: 'u3', name: 'Caio' },
];

describe('extractMentionedUserIds', () => {
  it('encontra menções ignorando maiúsculas', () => {
    expect(extractMentionedUserIds('oi @caio, tudo bem?', members)).toEqual(['u3']);
  });

  it('o nome mais longo não conta também como o mais curto', () => {
    expect(extractMentionedUserIds('@Ana Souza chegou', members)).toEqual(['u2']);
    expect(extractMentionedUserIds('@Ana e @Ana Souza', members).sort()).toEqual(['u1', 'u2']);
  });

  it('ignora quem deve ser excluído e textos sem menção', () => {
    expect(extractMentionedUserIds('@Caio', members, 'u3')).toEqual([]);
    expect(extractMentionedUserIds('sem menção', members)).toEqual([]);
  });
});

describe('appendMention', () => {
  it('acrescenta com espaçamento correto', () => {
    expect(appendMention('', 'Ana')).toBe('@Ana ');
    expect(appendMention('oi', 'Ana')).toBe('oi @Ana ');
    expect(appendMention('oi ', 'Ana')).toBe('oi @Ana ');
  });
});
