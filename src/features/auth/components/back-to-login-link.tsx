import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';

/** The way back to the sign-in, at the foot of every screen of the password recovery. */
export function BackToLoginLink({ loginPath }: { loginPath: string }) {
  return (
    <Link
      to={loginPath}
      className="text-primary inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium underline-offset-4 hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Voltar para o login
    </Link>
  );
}
