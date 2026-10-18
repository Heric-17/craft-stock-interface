import { describe, expect, it } from 'vitest';

import {
  changePasswordSchema,
  toChangePasswordRequest,
  type ChangePasswordFormValues,
} from './change-password.schema';

const VALID: ChangePasswordFormValues = {
  currentPassword: 'a senha de hoje',
  newPassword: 'uma senha nova longa',
  confirmPassword: 'uma senha nova longa',
};

function issuesFor(values: Partial<ChangePasswordFormValues>): Record<string, string> {
  const result = changePasswordSchema.safeParse({ ...VALID, ...values });

  if (result.success) {
    return {};
  }

  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
  );
}

describe('changePasswordSchema', () => {
  it('accepts a form filled in correctly', () => {
    expect(changePasswordSchema.safeParse(VALID).success).toBe(true);
  });

  it('asks for the current password', () => {
    expect(issuesFor({ currentPassword: '' })).toEqual({
      currentPassword: 'Informe a senha atual.',
    });
  });

  it('refuses a new password shorter than the API takes, on the new password field', () => {
    expect(issuesFor({ newPassword: 'curta', confirmPassword: 'curta' })).toEqual({
      newPassword: 'A senha precisa ter pelo menos 8 caracteres.',
    });
  });

  it('refuses a confirmation that differs, on the confirmation field', () => {
    expect(issuesFor({ confirmPassword: 'outra senha nova' })).toEqual({
      confirmPassword: 'As senhas não são iguais.',
    });
  });

  it('refuses a new password equal to the current one', () => {
    expect(
      issuesFor({
        currentPassword: 'a mesma senha',
        newPassword: 'a mesma senha',
        confirmPassword: 'a mesma senha',
      }),
    ).toEqual({ newPassword: 'A nova senha precisa ser diferente da atual.' });
  });

  it('sends both passwords exactly as typed, spaces included, without the confirmation', () => {
    const values = {
      currentPassword: ' atual com espaço ',
      newPassword: ' nova com espaço ',
      confirmPassword: ' nova com espaço ',
    };

    expect(toChangePasswordRequest(changePasswordSchema.parse(values))).toEqual({
      currentPassword: ' atual com espaço ',
      newPassword: ' nova com espaço ',
    });
  });
});
