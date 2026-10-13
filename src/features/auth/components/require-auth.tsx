import { Navigate, Outlet, useLocation } from 'react-router';
import { useSession } from '../api/use-session';
import { loginPath } from '../model/redirect';
import { SessionLoading, SessionRestoreFailed } from './session-screens';
export function RequireAuth() {
  const session = useSession();
  const location = useLocation();
  switch (session.status) {
    case 'restoring':
      return <SessionLoading />;
    case 'restore-failed':
      return <SessionRestoreFailed error={session.error} />;
    case 'anonymous':
      return (
        <Navigate
          to={
            session.reason === 'signed-out'
              ? '/login'
              : loginPath(`${location.pathname}${location.search}${location.hash}`)
          }
          replace
        />
      );
    case 'authenticated':
      return <Outlet />;
  }
}
