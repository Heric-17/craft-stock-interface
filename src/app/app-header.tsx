import { ChevronRight, Menu } from 'lucide-react';
import type { Ref } from 'react';
import { Link, useMatches } from 'react-router';
import { cn } from '@/shared/lib/cn';
import { ThemeToggle } from '@/shared/ui/theme-toggle';
import { crumbOf } from './route-handle';
export function AppHeader({
  onOpenMenu,
  menuButtonRef,
}: {
  onOpenMenu: (() => void) | null;
  menuButtonRef: Ref<HTMLButtonElement>;
}) {
  const crumbs = useMatches().flatMap((match) => {
    const label = crumbOf(match.handle);
    return label === null ? [] : [{ label, to: match.pathname }];
  });
  return (
    <header className="border-border bg-background/90 sticky top-0 z-10 flex h-14 items-center gap-2 border-b px-2 pt-[env(safe-area-inset-top)] backdrop-blur md:h-16 md:gap-3 md:px-10">
      {onOpenMenu === null ? null : (
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="Abrir menu"
          aria-haspopup="dialog"
          onClick={onOpenMenu}
          className="text-muted-foreground hover:bg-muted grid size-11 shrink-0 place-items-center rounded-md"
        >
          <Menu aria-hidden="true" className="size-5" />
        </button>
      )}
      <nav aria-label="Você está em" className="min-w-0">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm">
          <li className="flex shrink-0 items-center gap-1.5">
            <Link
              to="/"
              className={cn(
                'text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center text-xs',
                crumbs.length === 0 && 'text-foreground font-semibold',
              )}
            >
              CraftStock
            </Link>
          </li>
          {crumbs.map((crumb, index) => {
            const isCurrent = index === crumbs.length - 1;
            return (
              <li key={crumb.to} className="flex min-w-0 items-center gap-1.5">
                <ChevronRight
                  aria-hidden="true"
                  className="text-muted-foreground size-3 shrink-0"
                />
                {isCurrent ? (
                  <span
                    aria-current="page"
                    className="text-foreground truncate text-xs font-semibold"
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    to={crumb.to}
                    className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center text-xs"
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <ThemeToggle className="ml-auto md:-mr-2" />
    </header>
  );
}
