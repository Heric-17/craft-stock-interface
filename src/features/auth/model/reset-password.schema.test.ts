import { describe, expect, it } from 'vitest';

import { resetPasswordSchema, toResetPasswordRequest } from './reset-password.schema';

function issuesFor(values: { newPassword: string; confirmPassword: string }) {
  const result = resetPasswordSchema.safeParse(values);

  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
}

describe('resetPasswordSchema', () => {
  it('accepts two equal passwords of a valid length', () => {
    expect(
      resetPasswordSchema.safeParse({
        newPassword: 'uma senha nova longa',
        confirmPassword: 'uma senha nova longa',
      }).success,
    ).toBe(true);
  });

  it('refuses a short password on the password field', () => {
    expect(issuesFor({ newPassword: 'curta', confirmPassword: 'curta' })).toEqual({
      newPassword: 'A senha precisa ter pelo menos 8 caracteres.',
    });
  });

  it('refuses a confirmation that differs, on the confirmation field', () => {
    expect(
      issuesFor({ newPassword: 'uma senha nova longa', confirmPassword: 'outra senha longa' }),
    ).toEqual({ confirmPassword: 'As senhas não são iguais.' });
  });

  it('sends the token and the password as typed, without the confirmation', () => {
    const values = resetPasswordSchema.parse({
      newPassword: ' senha com espaço ',
      confirmPassword: ' senha com espaço ',
    });

    expect(toResetPasswordRequest('o-token', values)).toEqual({
      token: 'o-token',
      newPassword: ' senha com espaço ',
    });
  });
});
