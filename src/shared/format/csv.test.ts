import { describe, expect, it } from 'vitest';

import { Money, Percentage, requireDecimalString } from '@/shared/money';

import { formatSheetMoney, formatSheetPercent, toCsv } from './csv';

const money = (value: string) => Money.parse(requireDecimalString(value));

describe('formatSheetMoney', () => {
  it.each([
    ['1284.70', '1284,70'],
    ['0.00', '0,00'],
    ['0.5', '0,50'],
    ['1000000.00', '1000000,00'],
    ['-3.45', '-3,45'],
  ])('writes %s as %s: a comma for the cents, no thousands dot, no currency', (value, expected) => {
    expect(formatSheetMoney(money(value))).toBe(expected);
  });

  it('rounds at the cent, as the screen does', () => {
    expect(formatSheetMoney(money('0.0280'))).toBe('0,03');
  });
});

describe('formatSheetPercent', () => {
  it('writes a share with its one place and nothing around it', () => {
    const share = Percentage.ofMoney(money('54.00'), money('90.00'));

    expect(share === null ? null : formatSheetPercent(share)).toBe('60,0');
  });
});

describe('toCsv', () => {
  it('separates cells with a semicolon and rows with a line break', () => {
    expect(
      toCsv([
        ['Mês', 'Gasto (R$)'],
        ['maio de 2026', '300,00'],
      ]),
    ).toBe('Mês;Gasto (R$)\r\nmaio de 2026;300,00');
  });

  it('keeps a blank row as a blank line, which is how a report separates its sections', () => {
    expect(toCsv([['a'], [], ['b']])).toBe('a\r\n\r\nb');
  });

  it('wraps a cell that holds the separator, a quote or a line break, doubling the quotes', () => {
    expect(toCsv([['Casa; Cia', 'diz "oi"', 'duas\nlinhas']])).toBe(
      '"Casa; Cia";"diz ""oi""";"duas\nlinhas"',
    );
  });

  it('does not let the name of a shop run as a formula in a spreadsheet', () => {
    expect(toCsv([['=SOMA(A1:A9)', '+1', '@x', '-cmd']])).toBe("'=SOMA(A1:A9);'+1;'@x;'-cmd");
  });

  it('leaves a negative amount alone: it is a number, not a formula', () => {
    expect(toCsv([['-3,45', '-12']])).toBe('-3,45;-12');
  });
});
