import { useId, type ComponentProps } from 'react';
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
  error?: string | undefined;
};
export function EchoField({
  label,
  value,
  onChange,
  reading,
  adornmentStart,
  adornmentEnd,
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
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {adornmentStart === undefined ? null : (
          <span
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm whitespace-nowrap"
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
            adornmentStart === undefined ? undefined : 'pl-10',
            adornmentEnd === undefined ? undefined : 'pr-12',
            className,
          )}
        />
        {adornmentEnd === undefined ? null : (
          <span
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm whitespace-nowrap"
          >
            {adornmentEnd}
          </span>
        )}
      </div>
      {}
      <p id={echoId} aria-live="polite" className="text-muted-foreground min-h-4 text-xs">
        {reading === null ? null : (
          <>
            Entendido como <span className="text-foreground font-semibold">{reading}</span>
          </>
        )}
      </p>
      {error === undefined ? null : (
        <p id={errorId} className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
