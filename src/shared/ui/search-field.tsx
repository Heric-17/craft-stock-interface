import { Search } from 'lucide-react';
import { useId, type ComponentProps } from 'react';

import { Input } from './input';
import { Label } from './label';

export type SearchFieldProps = Omit<ComponentProps<'input'>, 'type' | 'value' | 'onChange'> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function SearchField({
  label,
  value,
  onChange,
  id: idProp,
  className,
  ...props
}: SearchFieldProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;

  return (
    <div className={className}>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          {...props}
          id={id}
          type="search"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="pl-9"
        />
      </div>
    </div>
  );
}
