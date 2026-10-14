import { useId, type ComponentProps } from 'react';

import { cn } from '@/shared/lib/cn';

export type CheckboxFieldProps = Omit<ComponentProps<'input'>, 'type'> & {
  label: string;
};

/** The whole row is the target, so it is 44px tall and tappable anywhere. */
export function CheckboxField({ label, id: idProp, className, ...props }: CheckboxFieldProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;

  return (
    <label
      htmlFor={id}
      className={cn(
        'text-foreground flex min-h-11 cursor-pointer items-center gap-2.5 text-sm select-none',
        className,
      )}
    >
      <input
        {...props}
        id={id}
        type="checkbox"
        className="border-input accent-primary size-5 shrink-0 rounded"
      />
      {label}
    </label>
  );
}
