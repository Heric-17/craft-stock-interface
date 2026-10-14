import { describe, expect, it } from 'vitest';

import {
  normalizeDecimalInput,
  parseBasisPointsInput,
  parseCentsInput,
  parseMoneyInput,
  parseQuantityInput,
} from './parse-input';

describe('normalizeDecimalInput', () => {
  it.each([
    ['1.284,70', '1284.70'],
    ['1,5', '1.5'],
    ['28,00', '28.00'],
    ['1.284.567,89', '1284567.89'],
    ['-3,45', '-3.45'],
    ['42', '42'],
    ['1.284', '1284'],
    ['R$ 1.284,70', '1284.70'],
    [' 1,5 ', '1.5'],
  ])('reads %p as %p', (text, expected) => {
    expect(normalizeDecimalInput(text)).toBe(expected);
  });

  it('reads a dot as a decimal point when it cannot be grouping', () => {
    // A numeric keypad offers a dot, and "1.5" is one and a half to the person
    // who typed it. "1.284" is grouping, which is what pt-BR writes.
    expect(normalizeDecimalInput('1.5')).toBe('1.5');
    expect(normalizeDecimalInput('0.145')).toBe('0.145');
  });

  it.each(['', '   ', 'abc', '1,2,3', '1e3', '--1', '1,', ',5', 'R$'])('refuses %p', (text) => {
    expect(normalizeDecimalInput(text)).toBeNull();
  });
});

describe('parseMoneyInput', () => {
  it('reads what a person typed into an amount', () => {
    expect(parseMoneyInput('1.284,70')?.toCentsString()).toBe('1284.70');
    expect(parseMoneyInput('1,5')?.toCentsString()).toBe('1.50');
    expect(parseMoneyInput('28')?.toCentsString()).toBe('28.00');
  });

  it('answers null for an empty field rather than zero', () => {
    // An empty optional field is absent, not nothing-spent.
    expect(parseMoneyInput('')).toBeNull();
    expect(parseMoneyInput('   ')).toBeNull();
  });

  it('refuses text finer than an amount can hold, instead of dropping a digit in silence', () => {
    expect(parseMoneyInput('10,00005')).toBeNull();
  });
});

describe('normalizeDecimalInput with a lone dot read as decimal', () => {
  it.each([
    ['1.500', '1.500'],
    ['1.284', '1.284'],
    ['0.145', '0.145'],
    ['1.5', '1.5'],
    ['1.234.567', '1234567'],
    ['1.500,5', '1500.5'],
    ['1500', '1500'],
  ])('reads %p as %p', (text, expected) => {
    expect(normalizeDecimalInput(text, 'decimal')).toBe(expected);
  });
});

describe('parseCentsInput', () => {
  it('reads whole cents like parseMoneyInput', () => {
    expect(parseCentsInput('1.284,70')?.toCentsString()).toBe('1284.70');
    expect(parseCentsInput('1.284')?.toCentsString()).toBe('1284.00');
  });

  it('refuses a third decimal place instead of rounding it behind the typed digits', () => {
    expect(parseCentsInput('1,005')).toBeNull();
    expect(parseCentsInput('0.145')).toBeNull();
  });

  it('answers null for an empty field', () => {
    expect(parseCentsInput('')).toBeNull();
  });
});

describe('parseQuantityInput', () => {
  it('reads a lone dot as a decimal point: 1.500 in a g field is 1,5 g', () => {
    expect(parseQuantityInput('1.500', 'GRAM')?.toApiNumber()).toBe(1.5);
    expect(parseQuantityInput('1.500,5', 'GRAM')?.toApiNumber()).toBe(1500.5);
    expect(parseQuantityInput('1.500', 'GRAM', 'major')?.toApiNumber()).toBe(1500);
  });

  it('reads the base unit by default', () => {
    expect(parseQuantityInput('680', 'GRAM')?.toApiNumber()).toBe(680);
    expect(parseQuantityInput('0,145', 'GRAM')?.toApiNumber()).toBe(0.145);
  });

  it('turns 1,5 in a kg field into 1500 g', () => {
    const quantity = parseQuantityInput('1,5', 'GRAM', 'major');

    expect(quantity?.toApiNumber()).toBe(1500);
    expect(quantity?.unit).toBe('GRAM');
  });

  it('turns 1,5 in a L field into 1500 ml and in a m field into 150 cm', () => {
    expect(parseQuantityInput('1,5', 'MILLILITER', 'major')?.toApiNumber()).toBe(1500);
    expect(parseQuantityInput('1,5', 'CENTIMETER', 'major')?.toApiNumber()).toBe(150);
  });

  it('answers null for an empty field', () => {
    expect(parseQuantityInput('', 'GRAM')).toBeNull();
  });

  it('refuses a fourth decimal place instead of rounding it', () => {
    expect(parseQuantityInput('0,1455', 'GRAM')).toBeNull();
    expect(parseQuantityInput('1,0005', 'UNIT')).toBeNull();
    expect(parseQuantityInput('0,145', 'GRAM')?.toApiNumber()).toBe(0.145);
  });

  it('does not count trailing zeros as places', () => {
    expect(parseQuantityInput('1,5000', 'GRAM')?.toApiNumber()).toBe(1.5);
  });

  it('keeps the places a larger unit adds: 1,2345 kg is exactly 1234,5 g', () => {
    expect(parseQuantityInput('1,2345', 'GRAM', 'major')?.toApiNumber()).toBe(1234.5);
    expect(parseQuantityInput('1,2345', 'CENTIMETER', 'major')?.toApiNumber()).toBe(123.45);
    expect(parseQuantityInput('1,0005', 'UNIT', 'major')).toBeNull();
  });
});

describe('parseBasisPointsInput', () => {
  it.each([
    ['33,33', 3333],
    ['35', 3500],
    ['0,5', 50],
    ['0', 0],
    ['100', 10_000],
    ['999,99', 99_999],
  ])('reads %p as %i basis points', (text, expected) => {
    expect(parseBasisPointsInput(text)).toBe(expected);
  });

  it('refuses a margin above what the column holds, on the field', () => {
    expect(parseBasisPointsInput('1000')).toBeNull();
    expect(parseBasisPointsInput('-5')).toBeNull();
  });

  it('refuses a third decimal place instead of rounding it', () => {
    expect(parseBasisPointsInput('33,333')).toBeNull();
    expect(parseBasisPointsInput('0,005')).toBeNull();
    // Trailing zeros are not places.
    expect(parseBasisPointsInput('33,330')).toBe(3333);
  });

  it('answers null for an empty field, which a required margin treats as missing', () => {
    // A Material sold on its own needs a margin: empty is empty, never zero.
    expect(parseBasisPointsInput('')).toBeNull();
  });
});
