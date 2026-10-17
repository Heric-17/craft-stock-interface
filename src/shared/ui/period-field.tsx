import { useId } from 'react';

import {
  formatPeriodPreset,
  resolvePeriod,
  type PeriodPreset,
  type PeriodSelection,
} from '@/shared/format';

import { Input } from './input';
import { Label } from './label';
import { SelectField } from './select-field';

const PRESETS: readonly PeriodPreset[] = ['THIS_MONTH', 'LAST_6_MONTHS', 'LAST_12_MONTHS'];

const CUSTOM = 'CUSTOM';

interface PeriodFieldProps {
  value: PeriodSelection;
  onChange: (value: PeriodSelection) => void;
  label?: string;
  /**
   * Offers "Personalizado", two days typed in. On by default. A screen that reads
   * whole calendar months, like the monthly chart, turns it off: a period that
   * starts on the 10th would draw its first month as if it were complete.
   */
  allowCustom?: boolean;
}

/**
 * The period a screen asks the API about: a few calendar-month presets, or two
 * days typed in. It holds what the person chose — never an instant — and the
 * screen turns it into the range the API takes with `resolvePeriod`, which cuts
 * it in the calendar of `America/Sao_Paulo`, `from` inclusive and `to`
 * exclusive.
 *
 * Two days typed in are both days **to include**: picking 1 to 31 January is
 * all of January. An end before the start is said here, on the field.
 */
export function PeriodField({
  value,
  onChange,
  label = 'Período',
  allowCustom = true,
}: PeriodFieldProps) {
  const id = useId();
  const resolution = resolvePeriod(value);
  const problem =
    value.kind === 'custom' && !resolution.ok && resolution.reason === 'INVALID'
      ? 'A data final vem antes da inicial.'
      : undefined;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <SelectField
        label={label}
        value={value.kind === 'preset' ? value.preset : CUSTOM}
        onChange={(event) => {
          const next = event.target.value;

          onChange(
            next === CUSTOM ? { kind: 'custom' } : { kind: 'preset', preset: next as PeriodPreset },
          );
        }}
        className="sm:min-w-48"
      >
        {PRESETS.map((preset) => (
          <option key={preset} value={preset}>
            {formatPeriodPreset(preset)}
          </option>
        ))}
        {allowCustom ? <option value={CUSTOM}>Personalizado</option> : null}
      </SelectField>

      {value.kind === 'custom' ? (
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor={`${id}-start`}>De</Label>
              <Input
                id={`${id}-start`}
                type="date"
                value={value.startDate ?? ''}
                aria-invalid={problem === undefined ? undefined : true}
                onChange={(event) => onChange({ ...value, startDate: event.target.value })}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor={`${id}-end`}>Até</Label>
              <Input
                id={`${id}-end`}
                type="date"
                value={value.endDate ?? ''}
                aria-invalid={problem === undefined ? undefined : true}
                onChange={(event) => onChange({ ...value, endDate: event.target.value })}
              />
            </div>
          </div>
          {problem === undefined ? null : (
            <p role="alert" className="text-destructive text-xs">
              {problem}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
