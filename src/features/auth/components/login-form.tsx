import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { applyApiErrorToForm } from '@/shared/api/form-errors';
import { Button } from '@/shared/ui/button';
import { showErrorToast } from '@/shared/ui/error-toast';
import { TextField } from '@/shared/ui/text-field';
import { useLogin } from '../api/use-login';
import { loginSchema, type LoginFormValues } from '../model/login.schema';
export function LoginForm() {
  const { register, handleSubmit, setError, formState } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const login = useLogin();
  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onError: (error) => {
        if (!applyApiErrorToForm(error, setError)) {
          showErrorToast(error);
        }
      },
    });
  });
  const formError = formState.errors.root?.api?.message;
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
      {formError === undefined ? null : (
        <p
          role="alert"
          className="bg-destructive-muted text-destructive rounded-md px-3 py-2 text-sm"
        >
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" disabled={login.isPending} className="w-full">
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}
