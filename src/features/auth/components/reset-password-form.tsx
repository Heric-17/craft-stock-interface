import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { isApiError } from '@/shared/api/api-error';
import { messageForError } from '@/shared/api/error-messages';
import { applyApiErrorToForm } from '@/shared/api/form-errors';
import { PASSWORD_HINT } from '@/shared/lib/password-rules';
import { Button } from '@/shared/ui/button';
import { showErrorToast } from '@/shared/ui/error-toast';
import { TextField } from '@/shared/ui/text-field';

import { useResetPassword } from '../api/use-reset-password';
import {
  resetPasswordSchema,
  toResetPasswordRequest,
  type ResetPasswordFormValues,
} from '../model/reset-password.schema';

import { BackToLoginLink } from './back-to-login-link';

/**
 * Chooses the new password. A link the API no longer accepts is not a mistake in
 * the form, so it is handed up (`onLinkRejected`) and the screen swaps the form
 * for the way to ask for another; everything else the person can fix here.
 */
export function ResetPasswordForm({
  token,
  loginPath,
  onReset,
  onLinkRejected,
}: {
  token: string;
  loginPath: string;
  onReset: () => void;
  onLinkRejected: (message: string) => void;
}) {
  const { register, handleSubmit, setError, formState } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const resetPassword = useResetPassword();

  const onSubmit = handleSubmit((values) => {
    resetPassword.mutate(toResetPasswordRequest(token, values), {
      onSuccess: onReset,
      onError: (error) => {
        if (isApiError(error) && error.code === 'INVALID_PASSWORD_RESET_TOKEN') {
          onLinkRejected(messageForError(error));

          return;
        }

        if (!applyApiErrorToForm(error, setError)) {
          showErrorToast(error);
        }
      },
    });
  });

  const formError = formState.errors.root?.api?.message;

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      className="mt-6 flex flex-col gap-5"
    >
      <p className="text-muted-foreground text-sm text-pretty">
        Escolha a nova senha da sua conta. Depois, entre com ela.
      </p>
      <TextField
        label="Nova senha"
        type="password"
        autoComplete="new-password"
        error={formState.errors.newPassword?.message}
        {...register('newPassword')}
      />
      <p className="text-muted-foreground -mt-3 text-xs">{PASSWORD_HINT}</p>
      <TextField
        label="Repita a nova senha"
        type="password"
        autoComplete="new-password"
        error={formState.errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      {formError === undefined ? null : (
        <p
          role="alert"
          className="bg-destructive-muted text-destructive rounded-md px-3 py-2 text-sm"
        >
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" disabled={resetPassword.isPending} className="w-full">
        {resetPassword.isPending ? 'Salvando…' : 'Salvar nova senha'}
      </Button>
      <BackToLoginLink loginPath={loginPath} />
    </form>
  );
}
