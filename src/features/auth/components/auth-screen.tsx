import type { ReactNode } from 'react';

import { env } from '@/shared/config/env';
import { ThemeToggle } from '@/shared/ui/theme-toggle';

/**
 * The frame of every screen a visitor sees: the brand beside the content on a
 * wide screen, above it on a phone. The sign-in and the two screens of the
 * password recovery share it, so they look like one place.
 */
export function AuthScreen({ title, children }: { title: string; children: ReactNode }) {
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
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}
