export type { AuthTokenResponseDto, AuthUserDto } from '@/shared/api/auth-response.dto';

/** `POST /auth/login`. The password is sent as typed, untrimmed. */
export interface LoginRequestDto {
  email: string;
  password: string;
}
