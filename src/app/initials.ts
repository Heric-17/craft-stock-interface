/**
 * The letters in the round avatar: the first letter of the first and of the
 * last word of the name. One word gives one letter; an empty name gives `?`
 * rather than an empty circle.
 */
export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word !== '');
  const first = words[0];
  const last = words.at(-1);

  if (first === undefined || last === undefined) {
    return '?';
  }

  const letters = words.length === 1 ? [first] : [first, last];

  return letters
    .map((word) => word.charAt(0))
    .join('')
    .toLocaleUpperCase('pt-BR');
}
