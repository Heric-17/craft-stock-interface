import { describe, expect, it } from 'vitest';

import { NON_BREAKING_SPACE as NBSP } from './decimal';
import { formatCountdown, formatWait } from './duration';

describe('formatWait', () => {
  it.each([
    [1, `1${NBSP}segundo`],
    [45, `45${NBSP}segundos`],
    [59, `59${NBSP}segundos`],
    [60, `1${NBSP}minuto`],
    [742, `13${NBSP}minutos`],
    [900, `15${NBSP}minutos`],
    [3540, `59${NBSP}minutos`],
    [3600, `1${NBSP}hora`],
    [3900, `1${NBSP}hora e 5${NBSP}minutos`],
    [7200, `2${NBSP}horas`],
  ])('writes %i seconds as "%s"', (seconds, expected) => {
    expect(formatWait(seconds)).toBe(expected);
  });

  it('rounds up, so the person is never sent back a second too early', () => {
    expect(formatWait(61)).toBe(`2${NBSP}minutos`);
    expect(formatWait(0.2)).toBe(`1${NBSP}segundo`);
  });

  it('never says zero', () => {
    expect(formatWait(0)).toBe(`1${NBSP}segundo`);
  });

  it('keeps the number and its unit together', () => {
    expect(formatWait(900)).not.toContain(' minutos');
  });
});

describe('formatCountdown', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [45, '0:45'],
    [60, '1:00'],
    [754, '12:34'],
    [900, '15:00'],
    [3599, '59:59'],
    [3600, '1:00:00'],
    [3905, '1:05:05'],
  ])('writes %i seconds as %s', (seconds, expected) => {
    expect(formatCountdown(seconds)).toBe(expected);
  });

  it('does not go below zero', () => {
    expect(formatCountdown(-3)).toBe('0:00');
  });
});
