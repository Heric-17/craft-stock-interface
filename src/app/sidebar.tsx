import { LogOut } from 'lucide-react';
import { NavLink } from 'react-router';
import { useLogout, useSession } from '@/features/auth';
import { env } from '@/shared/config/env';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { showErrorToast } from '@/shared/ui/error-toast';
import { initialsOf } from './initials';
import { ACCOUNT_ENTRIES, NAV_GROUPS, type NavEntry } from './navigation';
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const session = useSession();
  const logout = useLogout();
  const user = session.status === 'authenticated' ? session.user : null;
  return (
    <div className="bg-sidebar text-sidebar-foreground flex h-full min-h-0 flex-col px-3 py-5">
      <div className="flex items-center gap-3 px-3 pb-6">
        <span
          aria-hidden="true"
          className="bg-sidebar-primary text-sidebar-primary-foreground grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold"
        >
          CS
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-sidebar-primary-foreground text-lg leading-tight font-bold tracking-tight">
            Craft<span className="text-sidebar-accent-foreground">Stock</span>
          </span>
          <span className="text-sidebar-muted-foreground truncate text-xs">
            {env.VITE_COMPANY_NAME}
          </span>
        </div>
      </div>
      <nav aria-label="Seções" className="min-h-0 flex-1 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="text-sidebar-muted-foreground px-3 pb-1.5 text-[0.625rem] font-bold tracking-[0.09em] uppercase">
              {group.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.entries.map((entry) => (
                <li key={entry.path}>
                  <SidebarLink entry={entry} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-sidebar-border flex flex-col gap-0.5 border-t pt-3">
        <ul className="flex flex-col gap-0.5">
          {ACCOUNT_ENTRIES.map((entry) => (
            <li key={entry.path}>
              <SidebarLink entry={entry} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
        {user === null ? null : (
          <div className="mt-2 flex items-center gap-3 px-3 py-2">
            <span
              aria-hidden="true"
              className="bg-sidebar-accent text-sidebar-accent-foreground grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold"
            >
              {initialsOf(user.name)}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-sidebar-primary-foreground truncate text-sm font-semibold">
                {user.name}
              </span>
              <span className="text-sidebar-muted-foreground truncate text-xs">{user.email}</span>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          disabled={logout.isPending}
          onClick={() => logout.mutate(undefined, { onError: showErrorToast })}
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full justify-start px-3"
        >
          <LogOut aria-hidden="true" />
          {logout.isPending ? 'Saindo…' : 'Sair'}
        </Button>
      </div>
    </div>
  );
}
function SidebarLink({
  entry,
  onNavigate,
}: {
  entry: NavEntry;
  onNavigate: (() => void) | undefined;
}) {
  const Icon = entry.icon;
  return (
    <NavLink
      to={entry.path}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
            : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        )
      }
    >
      <Icon aria-hidden="true" className="size-[1.125rem] shrink-0" />
      {entry.label}
    </NavLink>
  );
}
