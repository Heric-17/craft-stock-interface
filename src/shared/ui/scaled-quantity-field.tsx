import { baseUnitSymbol, majorUnitSymbol, type QuantityInputScale } from '@/shared/format';
import { cn } from '@/shared/lib/cn';
import { hasMajorUnit, type ConsumptionUnit } from '@/shared/quantity';

import { QuantityField, type QuantityFieldProps } from './quantity-field';

export type ScaledQuantityFieldProps = Omit<QuantityFieldProps, 'scale' | 'accessory'> & {
  scale: QuantityInputScale;
  onScaleChange: (scale: QuantityInputScale) => void;
};

/**
 * A quantity field that can be typed in the larger unit: `1,5` with `kg`
 * marked is 1500 g. The conversion exists only in the interface — what is sent
 * is always the base unit — and the unit switch sits on the same row as the
 * input and the echo under them says what was understood, in whichever unit is
 * marked.
 *
 * A unit with no larger one (`un`) gets the plain field.
 */
export function ScaledQuantityField({
  scale,
  onScaleChange,
  unit,
  ...props
}: ScaledQuantityFieldProps) {
  const switchable = hasMajorUnit(unit);

  return (
    <QuantityField
      {...props}
      unit={unit}
      scale={switchable ? scale : 'base'}
      accessory={
        switchable ? (
          <ScaleSwitch unit={unit} scale={scale} onChange={onScaleChange} label={props.label} />
        ) : undefined
      }
    />
  );
}

function ScaleSwitch({
  unit,
  scale,
  onChange,
  label,
}: {
  unit: ConsumptionUnit;
  scale: QuantityInputScale;
  onChange: (scale: QuantityInputScale) => void;
  label: string;
}) {
  const options: { value: QuantityInputScale; text: string }[] = [
    { value: 'base', text: baseUnitSymbol(unit) },
    { value: 'major', text: majorUnitSymbol(unit) },
  ];

  return (
    <div
      role="group"
      aria-label={`${label}: unidade de digitação`}
      className="border-input bg-card inline-flex shrink-0 overflow-hidden rounded-md border"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={scale === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'min-w-14 px-4 text-base font-bold transition-colors',
            scale === option.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
        >
          {option.text}
        </button>
      ))}
    </div>
  );
}
