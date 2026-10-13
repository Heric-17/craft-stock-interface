import { Suspense, useRef, useState } from 'react';
import { Outlet } from 'react-router';

import { useIsDesktop } from '@/shared/lib/use-media-query';
import { LoadingSkeleton } from '@/shared/ui/loading-skeleton';
import { Sheet, SheetContent } from '@/shared/ui/sheet';

import { AppHeader } from './app-header';
import { SidebarContent } from './sidebar';

export function AppShell() {
  const isDesktop = useIsDesktop();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  return (
    <div className="bg-background flex min-h-dvh">
      <a
        href="#conteudo"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-4 py-3 text-sm font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>

      {isDesktop ? (
        <aside className="border-sidebar-border sticky top-0 h-dvh w-[17rem] shrink-0 border-r">
          <SidebarContent />
        </aside>
      ) : (
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent
            side="left"
            title="Menu de navegação"
            hideClose
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              menuButton.current?.focus();
            }}
          >
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          onOpenMenu={isDesktop ? null : () => setDrawerOpen(true)}
          menuButtonRef={menuButton}
        />

        <main
          id="conteudo"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] outline-none md:px-10 md:py-8"
        >
          <div className="mx-auto max-w-[76rem]">
            <Suspense fallback={<LoadingSkeleton variant="table" />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
