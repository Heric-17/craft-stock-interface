import { describe, expect, it } from 'vitest';

import { loginSchema } from './login.schema';

describe('loginSchema', () => {
  it('accepts an e-mail and a password', () => {
    expect(
      loginSchema.safeParse({ email: 'marina@exemplo.com.br', password: 's3nha' }).success,
    ).toBe(true);
  });

  it('trims the e-mail, since a pasted trailing space is the usual reason a correct one is refused', () => {
    const result = loginSchema.parse({ email: '  marina@exemplo.com.br ', password: 'x' });

    expect(result.email).toBe('marina@exemplo.com.br');
  });

  it('keeps the password exactly as typed, spaces included', () => {
    const result = loginSchema.parse({ email: 'marina@exemplo.com.br', password: ' com espaço ' });

    expect(result.password).toBe(' com espaço ');
  });

  it('asks for the e-mail and the password when they are empty', () => {
    const result = loginSchema.safeParse({ email: '', password: '' });

    expect(result.success).toBe(false);

    if (!result.success) {
      const messages = result.error.flatten().fieldErrors;

      // The form shows the first message of a field, so the one that asks comes first.
      expect(messages.email?.[0]).toBe('Informe o e-mail.');
      expect(messages.password).toEqual(['Informe a senha.']);
    }
  });

  it('says what is wrong with an address that is not one', () => {
    const result = loginSchema.safeParse({ email: 'marina', password: 'x' });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email?.[0]).toContain('e-mail válido');
    }
  });
});
