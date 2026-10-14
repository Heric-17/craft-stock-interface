import { ChevronDown } from 'lucide-react';
import { useId, type ComponentProps } from 'react';

import { cn } from '@/shared/lib/cn';

import { Label } from './label';

export type SelectFieldProps = ComponentProps<'select'> & {
  label: string;
  /** Hides the label visually; it stays for screen readers. */
  hideLabel?: boolean;
  error?: string | undefined;
  hint?: string | undefined;
};

/**
 * The browser's own select: on a phone it opens the system picker, which is
 * the right control for a short list under a thumb.
 */
export function SelectField({
  label,
  hideLabel = false,
  error,
  hint,
  id: idProp,
  className,
  children,
  ...props
}: SelectFieldProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const noteId = `${id}-note`;
  const note = error ?? hint;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className={cn(hideLabel && 'sr-only')}>
        {label}
      </Label>
      <div className="relative">
        <select
          {...props}
          id={id}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={note === undefined ? undefined : noteId}
          className={cn(
            'border-input bg-card text-foreground aria-invalid:border-destructive h-11 w-full min-w-0 appearance-none rounded-md border pr-9 pl-3 text-base transition-colors disabled:opacity-60 md:text-sm',
            className,
          )}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
        />
      </div>
      {note === undefined ? null : (
        <p
          id={noteId}
          className={cn(
            'text-xs text-pretty',
            error === undefined ? 'text-muted-foreground' : 'text-destructive',
          )}
        >
          {note}
        </p>
      )}
    </div>
  );
}
