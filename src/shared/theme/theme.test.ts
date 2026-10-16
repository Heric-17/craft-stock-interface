import { describe, expect, it } from 'vitest';

import { oppositeTheme, parseThemePreference, resolveTheme } from './theme';

describe('parseThemePreference', () => {
  it('reads the two themes back', () => {
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
  });

  it('takes nothing stored, or something this build does not know, as no choice made', () => {
    expect(parseThemePreference(null)).toBe('system');
    expect(parseThemePreference('')).toBe('system');
    expect(parseThemePreference('sepia')).toBe('system');
    expect(parseThemePreference('system')).toBe('system');
  });
});

describe('resolveTheme', () => {
  it('follows the system until a theme is chosen', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('keeps a chosen theme whatever the system asks for', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('oppositeTheme', () => {
  it('is the other one', () => {
    expect(oppositeTheme('light')).toBe('dark');
    expect(oppositeTheme('dark')).toBe('light');
  });
});
