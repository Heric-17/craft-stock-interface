import { readMoneyField } from '@/shared/format';
import { EchoField, type EchoFieldProps } from './echo-field';
export type MoneyFieldProps = Omit<EchoFieldProps, 'reading' | 'adornmentStart' | 'adornmentEnd'>;
export function MoneyField({ value, ...props }: MoneyFieldProps) {
  const reading = readMoneyField(value);
  return (
    <EchoField {...props} value={value} reading={reading?.display ?? null} adornmentStart="R$" />
  );
}
