import { useMemo } from 'react';

import {
  buildMonthsRange,
  buildPeriodRange,
  businessMonthLabel,
  presetMonthLabels,
  type PeriodPreset,
  type PeriodRange,
} from '@/shared/format';

/**
 * What a preset means for the spending panel, worked out once and handed to every
 * block that reads the dataset: the window the API is asked about, the months it
 * covers and which of them is the one still running.
 *
 * The blocks pass the same window to the same query, so the cache answers all of
 * them with one request.
 */
export interface PeriodWindow {
  preset: PeriodPreset;
  range: PeriodRange;
  /** This month and the one before it, for the month-over-month cards, whatever the period. */
  comparisonRange: PeriodRange;
  /** Every month of the period, oldest first, the running one last. */
  months: string[];
  /** The month that is still running: the last of `months`, and never a closed one. */
  currentMonth: string;
}

export function usePeriodWindow(preset: PeriodPreset): PeriodWindow {
  return useMemo(
    () => ({
      preset,
      range: buildPeriodRange(preset),
      comparisonRange: buildMonthsRange(2),
      months: presetMonthLabels(preset),
      currentMonth: businessMonthLabel(),
    }),
    [preset],
  );
}
