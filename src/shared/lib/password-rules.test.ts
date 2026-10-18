import { describe, expect, it } from 'vitest';

import {
  newPasswordSchema,
  PASSWORD_HINT,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from './password-rules';

function messageFor(value: string): string | undefined {
  const result = newPasswordSchema.safeParse(value);

  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('newPasswordSchema', () => {
  it('accepts the shortest and the longest password the API takes', () => {
    expect(newPasswordSchema.safeParse('a'.repeat(PASSWORD_MIN_LENGTH)).success).toBe(true);
    expect(newPasswordSchema.safeParse('a'.repeat(PASSWORD_MAX_LENGTH)).success).toBe(true);
  });

  it('asks for the password when nothing was typed', () => {
    expect(messageFor('')).toBe('Informe a nova senha.');
  });

  it('refuses one character short, and says how many are needed', () => {
    expect(messageFor('a'.repeat(PASSWORD_MIN_LENGTH - 1))).toBe(
      'A senha precisa ter pelo menos 8 caracteres.',
    );
  });

  it('refuses one character over', () => {
    expect(messageFor('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe(
      'A senha pode ter no máximo 128 caracteres.',
    );
  });

  it('keeps the spaces: they are part of the password', () => {
    const typed = '  uma senha com espaços  ';

    expect(newPasswordSchema.parse(typed)).toBe(typed);
  });

  it('writes the same limits in the hint under the field', () => {
    expect(PASSWORD_HINT).toBe('De 8 a 128 caracteres.');
  });
});
