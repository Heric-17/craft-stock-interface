import { z } from 'zod';

/**
 * The shape of the sign-in form. Zod checks only that something sensible was
 * typed; whether the credentials are right is the API's to say.
 *
 * The e-mail is trimmed because a trailing space pasted from a message is the
 * commonest reason for a correct address to be refused. The password is not:
 * a space in it is part of it.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Informe o e-mail.')
    .email('Informe um e-mail válido, como nome@empresa.com.br.'),
  password: z.string().min(1, 'Informe a senha.'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
