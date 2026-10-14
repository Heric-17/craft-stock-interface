import { readMarginField } from '@/shared/format';

import { EchoField, type EchoFieldProps } from './echo-field';

export type MarginFieldProps = Omit<EchoFieldProps, 'reading' | 'adornmentStart' | 'adornmentEnd'>;

/**
 * A profit margin, typed as the percentage it is: `33,33`. Basis points are
 * how it travels and how it is calculated, never what anyone is asked to
 * type, and the echo under the field says what the system understood.
 */
export function MarginField({ value, ...props }: MarginFieldProps) {
  const reading = readMarginField(value);

  return <EchoField {...props} value={value} reading={reading?.display ?? null} adornmentEnd="%" />;
}
