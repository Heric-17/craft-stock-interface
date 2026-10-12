import { describe, expect, it } from 'vitest';

import { toInt, toIntOr } from './to-int';

describe('toInt', () => {
  it('reads a plain integer', () => {
    expect(toInt('42')).toBe(42);
    expect(toInt('0')).toBe(0);
    expect(toInt('-7')).toBe(-7);
    expect(toInt('+7')).toBe(7);
  });

  it('ignores the whitespace a pasted parameter carries', () => {
    expect(toInt('  12  ')).toBe(12);
  });

  it('refuses what parseInt would have accepted halfway', () => {
    expect(toInt('12abc')).toBeNull();
    expect(toInt('1.5')).toBeNull();
    expect(toInt('1e3')).toBeNull();
    expect(toInt('0x10')).toBeNull();
  });

  it('refuses the empty and the absent', () => {
    expect(toInt('')).toBeNull();
    expect(toInt('   ')).toBeNull();
    expect(toInt(undefined)).toBeNull();
    expect(toInt(null)).toBeNull();
  });

  it('refuses an integer too large to be exact', () => {
    expect(toInt('9007199254740993')).toBeNull();
  });

  describe('toIntOr', () => {
    it('falls back when the parameter is missing or unreadable', () => {
      expect(toIntOr(undefined, 1)).toBe(1);
      expect(toIntOr('abc', 1)).toBe(1);
      expect(toIntOr('3', 1)).toBe(3);
    });
  });
});
