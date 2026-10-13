import { useId, type ComponentProps } from 'react';
import { Input } from './input';
import { Label } from './label';
export type TextFieldProps = ComponentProps<'input'> & {
  label: string;
  error?: string | undefined;
};
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
