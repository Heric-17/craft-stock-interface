import { z } from 'zod';

import { loginSchema } from './login.schema';

/**
 * The shape of the form that asks for the link: the e-mail, written the same way
 * as at the sign-in (trimmed, and checked only for looking like an address).
 */
export const forgotPasswordSchema = z.object({ email: loginSchema.shape.email });

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
