import { useId, type ComponentProps, type ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

import { Input } from './input';
import { Label } from './label';

export type EchoFieldProps = Omit<
  ComponentProps<'input'>,
  'value' | 'onChange' | 'type' | 'inputMode' | 'prefix'
> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  reading: string | null;
  adornmentStart?: string;
  adornmentEnd?: string;
  /**
   * Sits on the same row as the input, to its right: a unit switch, for
   * instance. It is part of how the number is typed, so it is not put on a line
   * of its own below.
   */
  accessory?: ReactNode;
  error?: string | undefined;
};

/**
 * A numeric field and what the system understood from it.
 *
 * The number is typed large — it is the thing being decided — and the unit,
 * when it can be switched, sits beside it on the same row. Under it, the
 * interpretation: "Entendido como 2 kg" in a box of its own, with the value in
 * a size that can be read at a glance, because the echo is the promise of what
 * will be sent and nobody should have to squint to check it.
 */
export function EchoField({
  label,
  value,
  onChange,
  reading,
  adornmentStart,
  adornmentEnd,
  accessory,
  error,
  id: idProp,
  className,
  ...props
}: EchoFieldProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const echoId = `${id}-echo`;
  const errorId = `${id}-error`;
  const describedBy = [reading === null ? null : echoId, error === undefined ? null : errorId]
    .filter((part) => part !== null)
    .join(' ');

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="font-semibold">
        {label}
      </Label>

      <div className="flex flex-wrap items-stretch gap-2">
        <div className="relative min-w-36 flex-1">
          {adornmentStart === undefined ? null : (
            <span
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center text-base font-semibold whitespace-nowrap"
            >
              {adornmentStart}
            </span>
          )}
          <Input
            {...props}
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={error === undefined ? undefined : true}
            aria-describedby={describedBy === '' ? undefined : describedBy}
            className={cn(
              'h-12 text-lg font-semibold md:text-lg',
              adornmentStart === undefined ? undefined : 'pl-11',
              adornmentEnd === undefined ? undefined : 'pr-12',
              className,
            )}
          />
          {adornmentEnd === undefined ? null : (
            <span
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-base font-semibold whitespace-nowrap"
            >
              {adornmentEnd}
            </span>
          )}
        </div>
        {accessory}
      </div>

      <p
        id={echoId}
        aria-live="polite"
        className={cn(
          'flex flex-wrap items-baseline gap-x-2 rounded-md px-3 text-sm',
          reading === null ? 'hidden' : 'bg-muted py-2',
        )}
      >
        {reading === null ? null : (
          <>
            <span className="text-muted-foreground">Entendido como</span>{' '}
            <span className="text-foreground text-lg font-bold">{reading}</span>
          </>
        )}
      </p>

      {error === undefined ? null : (
        <p id={errorId} className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
