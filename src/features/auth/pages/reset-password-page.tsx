import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { AuthScreen } from '../components/auth-screen';
import { ResetLinkProblem } from '../components/reset-link-problem';
import { ResetPasswordForm } from '../components/reset-password-form';
import { readResetToken } from '../model/reset-token';

const LINK_WITHOUT_CODE =
  'O endereço desta página não traz o código do link enviado por e-mail. Abra o link direto da mensagem ou peça um novo.';

/**
 * The second step of recovering a password, where the link in the e-mail lands.
 * The code is read from the address once and kept in memory, and the address is
 * then cleaned: the code is as good as a password, and it should not stay in the
 * history, in a bookmark or in a screenshot.
 *
 * Open to a visitor, like the first step. On success the person is taken to the
 * sign-in — no session is opened here, and the API closed the ones that existed.
 */
export function ResetPasswordPage({
  loginPath,
  forgotPasswordPath,
}: {
  loginPath: string;
  forgotPasswordPath: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => readResetToken(location.hash));
  const [rejection, setRejection] = useState<string | null>(null);

  useEffect(() => {
    if (location.hash !== '') {
      void navigate({ hash: '' }, { replace: true });
    }
  }, [location.hash, navigate]);

  if (token === null || rejection !== null) {
    return (
      <AuthScreen title={token === null ? 'Link incompleto' : 'Link sem validade'}>
        <ResetLinkProblem
          message={rejection ?? LINK_WITHOUT_CODE}
          loginPath={loginPath}
          forgotPasswordPath={forgotPasswordPath}
        />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="Nova senha">
      <ResetPasswordForm
        token={token}
        loginPath={loginPath}
        onReset={() => {
          toast.success('Senha alterada. Entre com a nova senha.');
          void navigate(loginPath, { replace: true });
        }}
        onLinkRejected={setRejection}
      />
    </AuthScreen>
  );
}
