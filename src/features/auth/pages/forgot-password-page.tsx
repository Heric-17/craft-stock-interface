import { useState } from 'react';

import { AuthScreen } from '../components/auth-screen';
import { ForgotPasswordForm } from '../components/forgot-password-form';
import { ResetLinkSent } from '../components/reset-link-sent';

/**
 * The first step of recovering a password: ask for the link by e-mail. Open to
 * a visitor, and it does not wait for the session to be restored — someone who
 * cannot sign in has nothing to restore.
 */
export function ForgotPasswordPage({ loginPath }: { loginPath: string }) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [lastEmail, setLastEmail] = useState('');

  return (
    <AuthScreen title="Esqueci minha senha">
      {sentTo === null ? (
        <ForgotPasswordForm
          loginPath={loginPath}
          defaultEmail={lastEmail}
          onSent={(email) => {
            setLastEmail(email);
            setSentTo(email);
          }}
        />
      ) : (
        <ResetLinkSent
          email={sentTo}
          loginPath={loginPath}
          onAskAgain={() => {
            setSentTo(null);
          }}
        />
      )}
    </AuthScreen>
  );
}
