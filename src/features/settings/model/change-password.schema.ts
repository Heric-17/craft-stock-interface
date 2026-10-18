import { z } from 'zod';

import { newPasswordSchema } from '@/shared/lib/password-rules';

import type { ChangePasswordRequestDto } from '../api/password.dto';

/**
 * The shape of the form that changes the password. Zod checks only what can be
 * seen from the form; whether the current password is right is the API's to say.
 *
 * The new password is typed twice because it cannot be seen and a slip here is
 * a login that no longer works. It must also differ from the current one: a
 * "change" to the same password closes the other devices for nothing.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Repita a nova senha.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não são iguais.',
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    path: ['newPassword'],
    message: 'A nova senha precisa ser diferente da atual.',
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

/** What goes to the API: the confirmation is only for the form. */
export function toChangePasswordRequest(
  values: ChangePasswordFormValues,
): ChangePasswordRequestDto {
  return { currentPassword: values.currentPassword, newPassword: values.newPassword };
}
