import { describe, expect, it } from 'vitest';

import {
  decimalStringToFraction,
  isDecimalString,
  parseDecimalString,
  renderScaledInteger,
  requireDecimalString,
  scaleDecimalString,
} from './decimal-string';
import { InvalidMoneyOperationError } from './money.error';

describe('isDecimalString', () => {
  it.each(['0', '42', '19.90', '0.0280', '-3.45', '-0.0001', '1000000.00'])(
    'accepts %p, which is a shape the API sends',
    (value) => {
      expect(isDecimalString(value)).toBe(true);
    },
  );

  it.each([
    '',
    ' 1.5',
    '1.5 ',
    '+1',
    '.5',
    '1.',
    '1,5',
    '1.2.3',
    '1e3',
    '1E3',
    'Infinity',
    'NaN',
    'R$ 1,50',
  ])('refuses %p', (value) => {
    expect(isDecimalString(value)).toBe(false);
  });

  it('refuses a number, however round it is', () => {
    expect(isDecimalString(19.9)).toBe(false);
    expect(isDecimalString(19)).toBe(false);
    expect(isDecimalString(null)).toBe(false);
    expect(isDecimalString(undefined)).toBe(false);
  });

  it('refuses a fifth decimal place, which the contract does not carry', () => {
    expect(isDecimalString('0.0280')).toBe(true);
    expect(isDecimalString('0.02801')).toBe(false);
  });
});

describe('parseDecimalString and requireDecimalString', () => {
  it('answers null where a value may be absent and throws where the contract promised one', () => {
    expect(parseDecimalString('oops')).toBeNull();
    expect(parseDecimalString('19.90')).toBe('19.90');
    expect(requireDecimalString('19.90')).toBe('19.90');
    expect(() => requireDecimalString('oops')).toThrow(InvalidMoneyOperationError);
  });

  it('says what it received, so a broken response can be read in the error', () => {
    expect(() => requireDecimalString(1.5)).toThrow(/number 1.5/);
    expect(() => requireDecimalString('1,5')).toThrow(/"1,5"/);
  });
});

describe('decimalStringToFraction', () => {
  it('reads a decimal string as an exact fraction of two integers', () => {
    expect(decimalStringToFraction('1.284')).toEqual({ numerator: 1284n, denominator: 1000n });
    expect(decimalStringToFraction('42')).toEqual({ numerator: 42n, denominator: 1n });
    expect(decimalStringToFraction('-0.05')).toEqual({ numerator: -5n, denominator: 100n });
  });
});

describe('scaleDecimalString', () => {
  it('is exact when the string has no more places than the scale', () => {
    expect(scaleDecimalString('1.5', 3)).toBe(1500n);
    expect(scaleDecimalString('0.0280', 4)).toBe(280n);
    expect(scaleDecimalString('-3.45', 4)).toBe(-34_500n);
  });

  it('rounds past the scale by the one policy, half away from zero', () => {
    expect(scaleDecimalString('0.1255', 3)).toBe(126n);
    expect(scaleDecimalString('0.1254', 3)).toBe(125n);
    expect(scaleDecimalString('-0.1255', 3)).toBe(-126n);
  });
});

describe('renderScaledInteger', () => {
  it('writes a scaled integer back out with exactly its places', () => {
    expect(renderScaledInteger(1500n, 3)).toBe('1.500');
    expect(renderScaledInteger(280n, 4)).toBe('0.0280');
    expect(renderScaledInteger(-34_500n, 4)).toBe('-3.4500');
    expect(renderScaledInteger(0n, 4)).toBe('0.0000');
    expect(renderScaledInteger(42n, 0)).toBe('42');
  });
});
