import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { isApiError } from '@/shared/api/api-error';
import { messageForError } from '@/shared/api/error-messages';
import { applyApiErrorToForm } from '@/shared/api/form-errors';
import { formatCountdown } from '@/shared/format';
import { useCooldown } from '@/shared/lib/use-cooldown';
import { Button } from '@/shared/ui/button';
import { showErrorToast } from '@/shared/ui/error-toast';
import { TextField } from '@/shared/ui/text-field';
import { useLogin } from '../api/use-login';
import { loginSchema, type LoginFormValues } from '../model/login.schema';
export function LoginForm({ forgotPasswordPath }: { forgotPasswordPath: string }) {
  const { register, handleSubmit, setError, clearErrors, formState } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const login = useLogin();
  const cooldown = useCooldown();
  // The rate limit's sentence is kept apart from the form's error: it belongs
  // to the wait, so it goes away with it, and a wrong-password message that was
  // on screen before is never the one taken down.
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const waiting = cooldown.remainingSeconds > 0;

  const onSubmit = handleSubmit((values) => {
    // A submit by Enter inside a field can still arrive while the button is
    // disabled; the API would refuse it again, so it never leaves.
    if (waiting) {
      return;
    }

    login.mutate(values, {
      onError: (error) => {
        // The wait is the answer. It is shown and counted down, never repeated:
        // another try inside it is refused again.
        if (isApiError(error) && error.retryAfterSeconds !== undefined) {
          clearErrors('root.api');
          setLimitMessage(messageForError(error));
          cooldown.start(error.retryAfterSeconds);
          return;
        }

        if (!applyApiErrorToForm(error, setError)) {
          showErrorToast(error);
        }
      },
    });
  });
  const formError = waiting ? limitMessage : formState.errors.root?.api?.message;
  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-5">
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
      <TextField
        label="Senha"
        type="password"
        autoComplete="current-password"
        error={formState.errors.password?.message}
        {...register('password')}
      />
      <Link
        to={forgotPasswordPath}
        className="text-primary -mt-3 inline-flex min-h-11 items-center self-start text-sm font-medium underline-offset-4 hover:underline"
      >
        Esqueci minha senha
      </Link>
      {formError === undefined || formError === null ? null : (
        <p
          role="alert"
          className="bg-destructive-muted text-destructive rounded-md px-3 py-2 text-sm"
        >
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" disabled={login.isPending || waiting} className="w-full">
        {login.isPending
          ? 'Entrando…'
          : waiting
            ? `Tente de novo em ${formatCountdown(cooldown.remainingSeconds)}`
            : 'Entrar'}
      </Button>
    </form>
  );
}
