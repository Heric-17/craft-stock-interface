import {
  MONEY_DECIMAL_PLACES,
  PERCENTAGE_DECIMAL_PLACES,
  type Money,
  type Percentage,
} from '@/shared/money';

import { absoluteUnits, formatScaledDecimal, isNegativeAtPlaces } from './decimal';

/**
 * What a spreadsheet in pt-BR expects: a semicolon between the cells, because the
 * comma is the decimal separator and would split every amount in two, and a line
 * break between the rows.
 */
const CELL_SEPARATOR = ';';
const ROW_SEPARATOR = '\r\n';

/** Places an amount carries in a sheet: the cent, both digits. */
const CENT_PLACES = 2;

/**
 * An amount as a cell, in Brazilian form and with nothing around it: `1284,70`.
 *
 * No `R$` and no thousands dot. A sheet reads `1284,70` as a number it can add
 * up, and `R$ 1.284,70` as text; the column header says what the unit is.
 */
export function formatSheetMoney(money: Money): string {
  const units = money.toScaledUnits();
  const sign = isNegativeAtPlaces(units, MONEY_DECIMAL_PLACES, CENT_PLACES) ? '-' : '';
  const digits = formatScaledDecimal(absoluteUnits(units), MONEY_DECIMAL_PLACES, {
    minPlaces: CENT_PLACES,
    maxPlaces: CENT_PLACES,
  });

  return `${sign}${digits}`;
}

/** A share as a cell: `72,4`, with the same single place the screen shows. */
export function formatSheetPercent(percentage: Percentage): string {
  const digits = formatScaledDecimal(
    absoluteUnits(percentage.toScaledUnits()),
    PERCENTAGE_DECIMAL_PLACES,
    { minPlaces: PERCENTAGE_DECIMAL_PLACES, maxPlaces: PERCENTAGE_DECIMAL_PLACES },
  );

  return `${percentage.isNegative() ? '-' : ''}${digits}`;
}

/**
 * One cell of the file. A cell that holds a separator, a quote or a line break is
 * wrapped in quotes, with the quotes inside doubled, which is how every
 * spreadsheet reads it back.
 *
 * A cell that opens with `=`, `+`, `-` or `@` would be run as a formula by a
 * spreadsheet, and a shop's name is text somebody else typed. Those get an
 * apostrophe in front, the one spelling every spreadsheet reads as "this is text".
 * A number is the exception: it opens with `-` when it is negative, on purpose.
 */
function escapeCell(cell: string): string {
  const isNumber = /^-?\d+(,\d+)?$/.test(cell);
  const safe = !isNumber && /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;

  return /[;"\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** The rows of a report as the text of a CSV file: semicolons, a row per line. */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(escapeCell).join(CELL_SEPARATOR)).join(ROW_SEPARATOR);
}
