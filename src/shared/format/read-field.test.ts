import { describe, expect, it } from 'vitest';

import { NON_BREAKING_SPACE as SPACE } from './decimal';
import { readMoneyField, readQuantityField } from './read-field';

describe('readQuantityField', () => {
  it.each([
    ['1.500', 'GRAM', 'base', 1.5, `1,5${SPACE}g`],
    ['0,145', 'GRAM', 'base', 0.145, `0,145${SPACE}g`],
    ['1500', 'GRAM', 'base', 1500, `1,5${SPACE}kg`],
    ['1.500,5', 'GRAM', 'base', 1500.5, `1.500,5${SPACE}g`],
    ['1,5', 'GRAM', 'major', 1500, `1,5${SPACE}kg`],
    ['1,5', 'MILLILITER', 'major', 1500, `1,5${SPACE}L`],
    ['1,5', 'CENTIMETER', 'major', 150, `150${SPACE}cm`],
    ['12', 'UNIT', 'base', 12, `12${SPACE}un`],
  ] as const)('reads %p in %s (%s) as %d, shown as %p', (text, unit, scale, sent, shown) => {
    const reading = readQuantityField(text, unit, scale);

    expect(reading?.display).toBe(shown);
    expect(reading?.value.toApiNumber()).toBe(sent);
  });

  it.each(['', '   ', 'abc', '1,2,3', '--1'])(
    'reads %p as nothing: no echo, nothing to send',
    (text) => {
      expect(readQuantityField(text, 'GRAM')).toBeNull();
    },
  );

  it('never shows a different quantity from the one it carries', () => {
    // Every value that has three decimal places must show them all, in some unit.
    for (const text of ['0,001', '999,999', '1000,001', '1234,567', '999999999,999']) {
      const reading = readQuantityField(text, 'GRAM')!;

      expect(
        readQuantityField(reading.display.replace(`${SPACE}g`, ''), 'GRAM')?.value.compare(
          reading.value,
        ),
      ).toBe(0);
    }
  });
});

describe('readMoneyField', () => {
  it('reads an amount and shows the cents that will be sent', () => {
    const reading = readMoneyField('1.284,7');

    expect(reading?.display).toBe(`R$${SPACE}1.284,70`);
    expect(reading?.value.toCentsString()).toBe('1284.70');
  });

  it('reads nothing for text with a third decimal place, which would be rounded', () => {
    expect(readMoneyField('1,005')).toBeNull();
    expect(readMoneyField('')).toBeNull();
    expect(readMoneyField('dez')).toBeNull();
  });
});
