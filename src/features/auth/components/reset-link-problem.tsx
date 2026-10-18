import { LinkIcon } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/shared/ui/button';

import { BackToLoginLink } from './back-to-login-link';

/**
 * A link that cannot be used: it never had a code, or the API refused the code
 * (expired, already used, never issued). Retyping the password would not help,
 * so the way out is a new link, which is one tap away.
 */
export function ResetLinkProblem({
  message,
  loginPath,
  forgotPasswordPath,
}: {
  message: string;
  loginPath: string;
  forgotPasswordPath: string;
}) {
  return (
    <div className="mt-6 flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="bg-warning-muted text-warning grid size-10 shrink-0 place-items-center rounded-lg"
        >
          <LinkIcon className="size-5" />
        </span>
        <p role="alert" className="min-w-0 text-sm text-pretty">
          {message}
        </p>
      </div>
      <Button asChild size="lg" className="w-full">
        <Link to={forgotPasswordPath}>Pedir um novo link</Link>
      </Button>
      <BackToLoginLink loginPath={loginPath} />
    </div>
  );
}
