import { MailCheck } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';

import { BackToLoginLink } from './back-to-login-link';

/**
 * What the person sees once the link was asked for. It says "if there is an
 * account", never "there is": the API answers the same either way, and so does
 * the screen.
 */
export function ResetLinkSent({
  email,
  loginPath,
  onAskAgain,
}: {
  email: string;
  loginPath: string;
  onAskAgain: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="bg-success-muted text-success grid size-10 shrink-0 place-items-center rounded-lg"
        >
          <MailCheck className="size-5" />
        </span>
        <p role="status" className="min-w-0 text-sm text-pretty">
          Se existir uma conta com <strong className="font-semibold break-words">{email}</strong>,
          enviamos um link para criar uma nova senha.
        </p>
      </div>
      <Callout tone="info">
        O link vale por 1 hora e só pode ser usado uma vez. Não chegou? Olhe a caixa de spam; se
        continuar sem chegar, espere 1 minuto e peça de novo.
      </Callout>
      <Button type="button" variant="outline" size="lg" onClick={onAskAgain} className="w-full">
        Pedir outro link
      </Button>
      <BackToLoginLink loginPath={loginPath} />
    </div>
  );
}
