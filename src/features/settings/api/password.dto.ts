/**
 * The wire shape of `POST /auth/change-password`, written by hand from section
 * 5 of `api-contract.md`. Both passwords are sent as typed, untrimmed; the
 * answer is a 204 with no body.
 */
export interface ChangePasswordRequestDto {
  currentPassword: string;
  newPassword: string;
}
