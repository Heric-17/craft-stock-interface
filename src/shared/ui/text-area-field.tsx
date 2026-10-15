import { useId, type ComponentProps } from 'react';

import { cn } from '@/shared/lib/cn';

import { Label } from './label';

export type TextAreaFieldProps = ComponentProps<'textarea'> & {
  label: string;
  error?: string | undefined;
  /** Shown beside the count when the field has a limit. */
  hint?: string | undefined;
};

/**
 * A free note. With `maxLength` it counts what is left, so the limit is known
 * before it is hit and not after the text was cut.
 */
export function TextAreaField({
  label,
  error,
  hint,
  id: idProp,
  className,
  maxLength,
  value,
  ...props
}: TextAreaFieldProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const errorId = `${id}-error`;
  const length = typeof value === 'string' ? value.length : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        {...props}
        id={id}
        value={value}
        maxLength={maxLength}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? undefined : errorId}
        className={cn(
          'border-input bg-card text-foreground placeholder:text-muted-foreground aria-invalid:border-destructive min-h-24 w-full min-w-0 resize-y rounded-md border px-3 py-2.5 text-base transition-colors disabled:opacity-60 md:text-sm',
          className,
        )}
      />
      {hint === undefined && maxLength === undefined ? null : (
        <p className="text-muted-foreground flex justify-between gap-3 text-xs">
          <span>{hint}</span>
          {maxLength === undefined ? null : (
            <span aria-hidden="true">
              {length}/{maxLength}
            </span>
          )}
        </p>
      )}
      {error === undefined ? null : (
        <p id={errorId} className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
