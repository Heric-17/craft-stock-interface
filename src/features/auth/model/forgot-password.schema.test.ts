import { describe, expect, it } from 'vitest';

import { forgotPasswordSchema } from './forgot-password.schema';

describe('forgotPasswordSchema', () => {
  it('accepts an address and trims what was pasted around it', () => {
    expect(forgotPasswordSchema.parse({ email: '  ana@exemplo.com.br ' })).toEqual({
      email: 'ana@exemplo.com.br',
    });
  });

  it('asks for the address when nothing was typed', () => {
    const result = forgotPasswordSchema.safeParse({ email: '   ' });

    expect(result.success ? [] : result.error.issues.map((issue) => issue.message)).toContain(
      'Informe o e-mail.',
    );
  });

  it('refuses something that is not an address', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'ana@' }).success).toBe(false);
  });
});
