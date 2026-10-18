import { z } from 'zod';

import { newPasswordSchema } from '@/shared/lib/password-rules';

import type { ResetPasswordRequestDto } from '../api/auth.dto';

/**
 * The shape of the form that chooses the new password. Typed twice because it
 * cannot be seen and a slip here is a login that does not work, after a link
 * that cannot be used again.
 */
export const resetPasswordSchema = z
  .object({
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Repita a nova senha.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não são iguais.',
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

/** What goes to the API: the token from the link and the password, without the confirmation. */
export function toResetPasswordRequest(
  token: string,
  values: ResetPasswordFormValues,
): ResetPasswordRequestDto {
  return { token, newPassword: values.newPassword };
}
