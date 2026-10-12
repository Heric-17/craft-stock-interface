import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';

import { useLogout, useSession } from '@/features/auth';
import { env } from '@/shared/config/env';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { showErrorToast } from '@/shared/ui/error-toast';

/**
 * One navigation entry. The list is short on purpose: a section appears here
 * when its screens exist, not before.
 */
interface NavItem {
  to: string;
  label: string;
  group: string;
}

const NAV_ITEMS: readonly NavItem[] = [{ to: '/', label: 'Início', group: 'Operação' }];

function navGroups(items: readonly NavItem[]): [string, NavItem[]][] {
  const groups = new Map<string, NavItem[]>();

  for (const item of items) {
    const existing = groups.get(item.group);

    if (existing === undefined) {
      groups.set(item.group, [item]);
    } else {
      existing.push(item);
    }
  }

  return [...groups.entries()];
}

/**
 * The frame every screen is mounted in.
 *
 * There is no company switcher and no plan under the name: one build serves
 * one installation, and the name comes from the environment. There is no role
 * under the user either, because there are no roles: the e-mail is all there is
 * to say about who is signed in. The bell the mockups show has nothing behind
 * it and is not here.
 */
export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const session = useSession();
  const logout = useLogout();

  return (
    <div className="bg-background flex min-h-screen">
      {drawerOpen ? (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}

      <aside
        id="sidebar-nav"
        className={cn(
          'bg-sidebar text-sidebar-foreground border-sidebar-border fixed inset-y-0 left-0 z-30 flex w-[17rem] flex-col border-r px-3 py-6 transition-transform duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0',
          drawerOpen ? 'translate-x-0' : '-translate-x-[105%]',
        )}
      >
        <div className="flex items-center gap-3 px-3 pb-7">
          <span className="bg-sidebar-primary text-sidebar-primary-foreground grid size-8 place-items-center rounded-lg text-sm font-bold">
            CS
          </span>
          <span className="text-lg font-bold tracking-tight text-white">
            Craft<span className="text-sidebar-accent-foreground">Stock</span>
          </span>
          <button
            type="button"
            aria-label="Fechar menu"
            className="text-sidebar-muted-foreground ml-auto grid size-11 place-items-center rounded-md md:hidden"
            onClick={() => setDrawerOpen(false)}
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <nav className="flex-1" aria-label="Seções">
          {navGroups(NAV_ITEMS).map(([group, items]) => (
            <div key={group} className="mb-5">
              <p className="text-sidebar-muted-foreground px-3 pb-2 text-[0.625rem] font-bold tracking-[0.09em] uppercase">
                {group}
              </p>
              <ul>
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end
                      onClick={() => setDrawerOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors',
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                            : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-sidebar-border flex flex-col gap-1 border-t pt-4">
          <p className="px-3 text-sm font-semibold text-white">{env.VITE_COMPANY_NAME}</p>
          {session.status === 'authenticated' ? (
            <p className="text-sidebar-muted-foreground truncate px-3 text-xs">
              {session.user.email}
            </p>
          ) : null}
          <Button
            variant="ghost"
            disabled={logout.isPending}
            onClick={() => logout.mutate(undefined, { onError: showErrorToast })}
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground mt-1 w-full justify-start px-3"
          >
            {logout.isPending ? 'Saindo…' : 'Sair'}
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="border-border flex h-[4.5rem] items-center gap-3 border-b bg-white/70 px-4 md:px-10">
          <button
            type="button"
            aria-label="Abrir menu"
            aria-expanded={drawerOpen}
            aria-controls="sidebar-nav"
            className="text-muted-foreground grid size-11 place-items-center rounded-md md:hidden"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>

          <p className="text-muted-foreground text-xs">
            <span className="text-foreground font-semibold">{env.VITE_COMPANY_NAME}</span>
          </p>
        </header>

        <main className="px-4 py-8 md:px-10">
          <div className="mx-auto max-w-[76rem]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
