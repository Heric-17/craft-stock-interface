import { Navigate, useSearchParams } from 'react-router';
import { useSession } from '../api/use-session';
import { AuthScreen } from '../components/auth-screen';
import { LoginForm } from '../components/login-form';
import { SessionLoading, SessionRestoreFailed } from '../components/session-screens';
import { safeDestination } from '../model/redirect';
export function LoginPage({ forgotPasswordPath }: { forgotPasswordPath: string }) {
  const session = useSession();
  const [params] = useSearchParams();
  if (session.status === 'restoring') {
    return <SessionLoading />;
  }
  if (session.status === 'restore-failed') {
    return <SessionRestoreFailed error={session.error} />;
  }
  if (session.status === 'authenticated') {
    return <Navigate to={safeDestination(params.get('redirect'))} replace />;
  }
  return (
    <AuthScreen title="Entrar">
      {session.reason === 'expired' ? (
        <p role="status" className="bg-info-muted text-info mt-4 rounded-md px-3 py-2 text-sm">
          Sua sessão expirou. Entre novamente para continuar de onde parou.
        </p>
      ) : null}
      <div className="mt-6">
        <LoginForm forgotPasswordPath={forgotPasswordPath} />
      </div>
    </AuthScreen>
  );
}
