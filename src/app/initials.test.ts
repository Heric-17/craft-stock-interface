import { describe, expect, it } from 'vitest';

import { initialsOf } from './initials';

describe('initialsOf', () => {
  it.each([
    ['Marina Alves', 'MA'],
    ['Marina', 'M'],
    ['  marina   de souza alves ', 'MA'],
    ['érica lima', 'ÉL'],
    ['', '?'],
    ['   ', '?'],
  ])('turns %p into %p', (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });
});
