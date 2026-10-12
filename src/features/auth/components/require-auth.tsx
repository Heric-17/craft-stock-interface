import { Navigate, Outlet, useLocation } from 'react-router';

import { useSession } from '../api/use-session';
import { loginPath } from '../model/redirect';

import { SessionLoading, SessionRestoreFailed } from './session-screens';

/**
 * The guard: every route under it needs a session, and the login is the only
 * one that does not.
 *
 * It sends a person whose session ended — refused on renewal, say — to the login
 * with the page they were on in `redirect`, so signing back in lands them where
 * they were. A person who chose to sign out goes to the bare login: coming back
 * to the page they just left would read as the sign-out not having worked.
 */
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
