import type { ReactNode } from 'react';

import { useIsDesktop } from '@/shared/lib/use-media-query';

import { Sheet, SheetContent } from './sheet';

interface ResponsiveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Read by screen readers as the dialog's name. */
  title: string;
  children: ReactNode;
}

/**
 * A panel that comes from the right on a desktop and up from the bottom on a
 * phone, where a thumb reaches the actions. Its content scrolls inside it, so
 * the header and the actions never leave the screen.
 */
export function ResponsiveSheet({ open, onOpenChange, title, children }: ResponsiveSheetProps) {
  const isDesktop = useIsDesktop();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        title={title}
        // Focus lands on the panel, not on its first field: opening a form would
        // otherwise select the text of the first input and, on a phone, raise
        // the keyboard over the form before anyone asked for it.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
        className="bg-card text-card-foreground border-border md:w-[28rem] max-md:h-[90dvh] border-l max-md:border-t max-md:border-l-0"
      >
        {children}
      </SheetContent>
    </Sheet>
  );
}

interface SheetPanelProps {
  title: string;
  description?: string | undefined;
  footer?: ReactNode;
  children: ReactNode;
}

/** Header, scrolling body, and a footer that stays in reach. */
export function SheetPanel({ title, description, footer, children }: SheetPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border flex flex-col gap-1 border-b py-4 pr-16 pl-5">
        <h2 aria-hidden="true" className="text-lg font-bold tracking-tight text-balance">
          {title}
        </h2>
        {description === undefined ? null : (
          <p className="text-muted-foreground text-sm text-pretty">{description}</p>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">{children}</div>
      {footer === undefined ? null : (
        <div className="border-border bg-card flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end">
          {footer}
        </div>
      )}
    </div>
  );
}
