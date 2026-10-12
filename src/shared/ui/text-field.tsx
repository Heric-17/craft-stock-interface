import { useId, type ComponentProps } from 'react';

import { Input } from './input';
import { Label } from './label';

export type TextFieldProps = ComponentProps<'input'> & {
  label: string;
  /** What is wrong with the value, already in plain Portuguese. */
  error?: string | undefined;
};

/**
 * A labelled input with its error tied to it: the label is clickable, the error
 * is announced with the field, and the field is marked invalid for assistive
 * technology as well as for the eye.
 */
export function TextField({ label, error, id: idProp, ...props }: TextFieldProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        {...props}
        id={id}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? undefined : errorId}
      />
      {error === undefined ? null : (
        <p id={errorId} className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
