import { ChevronDown, LogOut } from 'lucide-react';
import { useId, useState } from 'react';
import { matchPath, NavLink, useLocation } from 'react-router';
import { useLogout, useSession } from '@/features/auth';
import { env } from '@/shared/config/env';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { showErrorToast } from '@/shared/ui/error-toast';
import { initialsOf } from './initials';
import {
  ACCOUNT_ENTRIES,
  NAV_GROUPS,
  isNavParent,
  type NavChild,
  type NavEntry,
  type NavParent,
} from './navigation';
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
              {group.entries.map((item) =>
                isNavParent(item) ? (
                  <li key={item.label}>
                    <SidebarParent parent={item} onNavigate={onNavigate} />
                  </li>
                ) : (
                  <li key={item.path}>
                    <SidebarLink entry={item} onNavigate={onNavigate} />
                  </li>
                ),
              )}
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

/**
 * An entry that opens a list of screens. It is a button, not a link: it says
 * where the screens are, and each of them is the link. It opens by itself when
 * the current screen is one of its own, so you never land somewhere the menu
 * does not show, and it closes again only when you close it.
 */
function SidebarParent({
  parent,
  onNavigate,
}: {
  parent: NavParent;
  onNavigate: (() => void) | undefined;
}) {
  const { pathname } = useLocation();
  const listId = useId();
  const Icon = parent.icon;
  const active = parent.children.some(
    (child) => matchPath({ path: child.path, end: child.end ?? false }, pathname) !== null,
  );
  const [open, setOpen] = useState(active);
  const [wasActive, setWasActive] = useState(active);

  // Arriving at one of its screens opens it, however it was left.
  if (active !== wasActive) {
    setWasActive(active);

    if (active) {
      setOpen(true);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          active && !open && 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold',
        )}
      >
        <Icon aria-hidden="true" className="size-[1.125rem] shrink-0" />
        <span className="flex-1">{parent.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? (
        <ul
          id={listId}
          className="border-sidebar-border mt-0.5 ml-[1.4375rem] flex flex-col gap-0.5 border-l pl-2"
        >
          {parent.children.map((child) => (
            <li key={child.path}>
              <SidebarChildLink child={child} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function SidebarChildLink({
  child,
  onNavigate,
}: {
  child: NavChild;
  onNavigate: (() => void) | undefined;
}) {
  return (
    <NavLink
      to={child.path}
      end={child.end ?? false}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex min-h-11 items-center rounded-lg px-3 text-sm transition-colors',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
            : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        )
      }
    >
      {child.label}
    </NavLink>
  );
}
