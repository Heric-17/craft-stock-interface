import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { applyApiErrorToForm } from '@/shared/api/form-errors';
import { Button } from '@/shared/ui/button';
import { showErrorToast } from '@/shared/ui/error-toast';
import { TextField } from '@/shared/ui/text-field';

import { useForgotPassword } from '../api/use-forgot-password';
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '../model/forgot-password.schema';

import { BackToLoginLink } from './back-to-login-link';

/**
 * Asks for the link. Whatever the API answers for an address it knows or does
 * not, the screen moves on the same way: it cannot be used to find out who has
 * an account, so it does not try to say.
 */
export function ForgotPasswordForm({
  loginPath,
  defaultEmail,
  onSent,
}: {
  loginPath: string;
  /** What was typed before, when the person came back to ask again. */
  defaultEmail: string;
  onSent: (email: string) => void;
}) {
  const { register, handleSubmit, setError, formState } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: defaultEmail },
  });
  const forgotPassword = useForgotPassword();

  const onSubmit = handleSubmit((values) => {
    forgotPassword.mutate(values, {
      onSuccess: () => {
        onSent(values.email);
      },
      onError: (error) => {
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
        Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.
      </p>
      <TextField
        label="E-mail"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        error={formState.errors.email?.message}
        {...register('email')}
      />
      {formError === undefined ? null : (
        <p
          role="alert"
          className="bg-destructive-muted text-destructive rounded-md px-3 py-2 text-sm"
        >
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" disabled={forgotPassword.isPending} className="w-full">
        {forgotPassword.isPending ? 'Enviando…' : 'Enviar link'}
      </Button>
      <BackToLoginLink loginPath={loginPath} />
    </form>
  );
}
