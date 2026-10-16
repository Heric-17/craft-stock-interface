import { Navigate, useSearchParams } from 'react-router';
import { env } from '@/shared/config/env';
import { ThemeToggle } from '@/shared/ui/theme-toggle';
import { useSession } from '../api/use-session';
import { LoginForm } from '../components/login-form';
import { SessionLoading, SessionRestoreFailed } from '../components/session-screens';
import { safeDestination } from '../model/redirect';
export function LoginPage() {
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
    <div className="bg-background relative flex min-h-dvh flex-col md:flex-row">
      <ThemeToggle className="absolute top-2 right-2 z-10" />
      <aside className="bg-sidebar text-sidebar-foreground flex flex-col justify-center gap-2 px-6 py-8 md:w-2/5 md:px-12">
        <div className="flex items-center gap-3">
          <span className="bg-sidebar-primary text-sidebar-primary-foreground grid size-9 place-items-center rounded-lg text-sm font-bold">
            CS
          </span>
          <span className="text-sidebar-primary-foreground text-xl font-bold tracking-tight">
            Craft<span className="text-sidebar-accent-foreground">Stock</span>
          </span>
        </div>
        <p className="text-sidebar-muted-foreground text-sm md:mt-4">
          Estoque, preço e capacidade de produção em um só lugar.
        </p>
      </aside>
      <main className="flex flex-1 items-start justify-center px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] md:items-center md:px-10">
        <div className="w-full max-w-sm">
          <p className="text-muted-foreground text-[0.625rem] font-bold tracking-[0.1em] uppercase">
            {env.VITE_COMPANY_NAME}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Entrar</h1>
          {session.reason === 'expired' ? (
            <p role="status" className="bg-info-muted text-info mt-4 rounded-md px-3 py-2 text-sm">
              Sua sessão expirou. Entre novamente para continuar de onde parou.
            </p>
          ) : null}
          <div className="mt-6">
            <LoginForm />
          </div>
        </div>
      </main>
    </div>
  );
}
