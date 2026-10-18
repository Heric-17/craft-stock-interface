import { z } from 'zod';

/** What the API accepts for a password: 8 to 128 characters. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * The shape of a password someone is choosing, in every form that chooses one.
 * It is not trimmed: a space is part of a password, and it is sent exactly as
 * typed. Whether the password is right, or good enough, is the API's to say.
 */
export const newPasswordSchema = z
  .string()
  .min(1, 'Informe a nova senha.')
  .min(PASSWORD_MIN_LENGTH, `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)
  .max(PASSWORD_MAX_LENGTH, `A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`);

/** The line under a field where a password is chosen. */
export const PASSWORD_HINT = `De ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caracteres.`;
