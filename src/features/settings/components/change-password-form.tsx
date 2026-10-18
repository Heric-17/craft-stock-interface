import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { isApiError } from '@/shared/api/api-error';
import { messageForError } from '@/shared/api/error-messages';
import { applyApiErrorToForm } from '@/shared/api/form-errors';
import { PASSWORD_HINT } from '@/shared/lib/password-rules';
import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';
import { showErrorToast } from '@/shared/ui/error-toast';
import { FormSection } from '@/shared/ui/form-section';
import { TextField } from '@/shared/ui/text-field';

import { useChangePassword } from '../api/use-change-password';
import {
  changePasswordSchema,
  toChangePasswordRequest,
  type ChangePasswordFormValues,
} from '../model/change-password.schema';

const EMPTY_FORM: ChangePasswordFormValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

/**
 * Changes the password of the person who is signed in. This device stays
 * signed in and every other one is signed out, which the form says before the
 * person submits instead of after.
 *
 * A wrong current password is the one refusal that belongs to a field, so it is
 * shown under that field and the cursor goes back to it.
 */
export function ChangePasswordForm() {
  const { register, handleSubmit, setError, setFocus, reset, formState } =
    useForm<ChangePasswordFormValues>({
      resolver: zodResolver(changePasswordSchema),
      defaultValues: EMPTY_FORM,
    });
  const changePassword = useChangePassword();

  const onSubmit = handleSubmit((values) => {
    changePassword.mutate(toChangePasswordRequest(values), {
      onSuccess: () => {
        toast.success('Senha alterada. Nos outros aparelhos, será preciso entrar de novo.');
        reset(EMPTY_FORM);
      },
      onError: (error) => {
        if (isApiError(error) && error.code === 'INVALID_CURRENT_PASSWORD') {
          setError('currentPassword', { type: 'server', message: messageForError(error) });
          setFocus('currentPassword');

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
    <FormSection
      title="Alterar senha"
      description="Escolha uma senha nova para a sua conta."
      icon={KeyRound}
      tone="warning"
    >
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-5">
        <Callout tone="info">
          Ao alterar a senha, você continua conectado neste aparelho e é desconectado dos outros em
          que estiver usando o sistema.
        </Callout>
        <TextField
          label="Senha atual"
          type="password"
          autoComplete="current-password"
          error={formState.errors.currentPassword?.message}
          {...register('currentPassword')}
        />
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

        <Button
          type="submit"
          size="lg"
          disabled={changePassword.isPending}
          className="w-full sm:w-auto sm:self-start"
        >
          {changePassword.isPending ? 'Alterando…' : 'Alterar senha'}
        </Button>
      </form>
    </FormSection>
  );
}
