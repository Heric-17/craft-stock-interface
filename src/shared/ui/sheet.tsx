import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useRef, type ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
type Side = 'left' | 'right' | 'bottom';
const SIDE_CLASSES: Record<Side, string> = {
  left: 'inset-y-0 left-0 h-dvh w-[17rem] max-w-[85vw] data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
  right:
    'inset-y-0 right-0 h-dvh w-[22rem] max-w-[90vw] data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
  bottom:
    'inset-x-0 bottom-0 max-h-[90dvh] rounded-t-xl data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
};
type SheetContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  side?: Side;
  title: string;
  hideClose?: boolean;
};
export function SheetContent({
  side = 'left',
  title,
  hideClose = false,
  className,
  children,
  onInteractOutside,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: SheetContentProps) {
  // What had the focus when the panel opened. A panel opened by a plain button has no
  // Radix trigger to hand the focus back to, so without this it would be lost on close.
  const opener = useRef<Element | null>(null);

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="sheet-overlay"
        className="bg-scrim data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-40"
      />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        aria-describedby={undefined}
        className={cn(
          'fixed z-50 flex flex-col shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:animate-in data-[state=open]:duration-300',
          'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
          SIDE_CLASSES[side],
          className,
        )}
        // A toast lives outside the panel, but it is part of the screen the panel is
        // open over: tapping one — to copy a support code, say — must not close it.
        onInteractOutside={(event) => {
          if (event.target instanceof Element && event.target.closest('[data-sonner-toaster]')) {
            event.preventDefault();
          }
          onInteractOutside?.(event);
        }}
        // Runs just before the focus moves into the panel, so the opener still has it.
        onOpenAutoFocus={(event) => {
          opener.current = document.activeElement;
          onOpenAutoFocus?.(event);
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          const target = opener.current;

          if (!event.defaultPrevented && target instanceof HTMLElement && target.isConnected) {
            event.preventDefault();
            target.focus();
          }
        }}
        {...props}
      >
        <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
        {children}
        {hideClose ? null : (
          <DialogPrimitive.Close
            aria-label="Fechar"
            className="text-muted-foreground absolute top-3 right-3 grid size-11 place-items-center rounded-md"
          >
            <X aria-hidden="true" className="size-5" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
