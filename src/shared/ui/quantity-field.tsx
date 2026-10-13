import {
  baseUnitSymbol,
  majorUnitSymbol,
  readQuantityField,
  type QuantityInputScale,
} from '@/shared/format';
import type { ConsumptionUnit } from '@/shared/quantity';
import { EchoField, type EchoFieldProps } from './echo-field';
export type QuantityFieldProps = Omit<
  EchoFieldProps,
  'reading' | 'adornmentStart' | 'adornmentEnd'
> & {
  unit: ConsumptionUnit;
  scale?: QuantityInputScale;
};
export function QuantityField({ unit, scale = 'base', value, ...props }: QuantityFieldProps) {
  const reading = readQuantityField(value, unit, scale);
  return (
    <EchoField
      {...props}
      value={value}
      reading={reading?.display ?? null}
      adornmentEnd={scale === 'major' ? majorUnitSymbol(unit) : baseUnitSymbol(unit)}
    />
  );
}
