import { InvalidDateValueError } from './date-time';

const MONTH_ABBREVIATIONS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

function readMonthLabel(label: string): { year: string; index: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(label);
  const index = match === null ? -1 : Number(match[2]) - 1;

  if (match === null || index < 0 || index > 11) {
    throw new InvalidDateValueError(label);
  }

  return { year: String(match[1]), index };
}

/**
 * A month of the API's monthly cells (`2026-10`) as a short label for an axis or
 * a row: `out`, and `out 2025` when `withYear` asks for it. The year is meant for
 * a period that crosses a turn of the year, where `jan` twice would be two
 * different months.
 */
export function formatMonthLabel(label: string, withYear = false): string {
  const { year, index } = readMonthLabel(label);
  const abbreviation = MONTH_ABBREVIATIONS[index] ?? '';

  return withYear ? `${abbreviation} ${year}` : abbreviation;
}

/** The same month written out, for a sentence: `outubro de 2026`. */
export function formatMonthName(label: string): string {
  const { year, index } = readMonthLabel(label);

  return `${MONTH_NAMES[index] ?? ''} de ${year}`;
}

/** The month alone, without the year: `setembro`. */
export function formatMonthNameShort(label: string): string {
  return MONTH_NAMES[readMonthLabel(label).index] ?? '';
}
