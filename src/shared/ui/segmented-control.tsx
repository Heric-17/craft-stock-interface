import { useId } from 'react';

import { cn } from '@/shared/lib/cn';

/** What the chosen option looks like: the colour says what the choice means. */
export type SegmentTone = 'primary' | 'success' | 'warning' | 'info' | 'neutral';

const SELECTED_CLASSES: Record<SegmentTone, string> = {
  primary: 'bg-primary text-primary-foreground',
  success: 'bg-success-muted text-success ring-success ring-2 ring-inset',
  warning: 'bg-warning-muted text-warning ring-warning ring-2 ring-inset',
  info: 'bg-info-muted text-info ring-info ring-2 ring-inset',
  neutral: 'bg-muted text-foreground ring-border ring-2 ring-inset',
};

export interface SegmentedOption<Value extends string> {
  value: Value;
  label: string;
  /** Colour of the option while it is the chosen one. `primary` when absent. */
  tone?: SegmentTone;
}

interface SegmentedControlProps<Value extends string> {
  /** What the control decides, read by a screen reader as the name of the group. */
  label: string;
  options: readonly SegmentedOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  disabled?: boolean;
  /** One line under the control, for what a choice causes. */
  hint?: string;
}

/**
 * A short, closed choice shown whole: every option is on screen at once, and
 * the current one is marked. For two or three options that change something
 * right away, where a select would hide the very state being shown.
 *
 * Each option is a 44px touch target and the group wraps rather than scrolls,
 * so three options fit a 360px screen. An option can carry a tone, so that
 * "Pago" is green and "Pendente" orange at a glance.
 */
export function SegmentedControl<Value extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  hint,
}: SegmentedControlProps<Value>) {
  const hintId = useId();

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div
        role="radiogroup"
        aria-label={label}
        aria-describedby={hint === undefined ? undefined : hintId}
        className="border-input bg-card flex w-full flex-wrap overflow-hidden rounded-md border"
      >
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => {
                if (!selected) {
                  onChange(option.value);
                }
              }}
              className={cn(
                'min-h-11 min-w-0 flex-1 px-3 text-sm transition-colors disabled:opacity-60',
                selected
                  ? cn('font-bold', SELECTED_CLASSES[option.tone ?? 'primary'])
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground font-medium',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {hint === undefined ? null : (
        <p id={hintId} className="text-muted-foreground text-xs text-pretty">
          {hint}
        </p>
      )}
    </div>
  );
}
