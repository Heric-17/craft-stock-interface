export type { AuthTokenResponseDto, AuthUserDto } from '@/shared/api/auth-response.dto';

/** `POST /auth/login`. The password is sent as typed, untrimmed. */
export interface LoginRequestDto {
  email: string;
  password: string;
}

/** `POST /auth/forgot-password`. The answer is a 204 whether or not an account has this address. */
export interface ForgotPasswordRequestDto {
  email: string;
}

/**
 * `POST /auth/reset-password`. The token is the one from the link in the e-mail;
 * the new password is sent as typed, untrimmed. The answer is a 204 and opens no
 * session.
 */
export interface ResetPasswordRequestDto {
  token: string;
  newPassword: string;
}
