/**
 * The theme as a value, with no React and no DOM: what the person chose, what
 * that resolves to, and how a stored string is read back.
 *
 * Two themes exist, and a third choice — "follow the system" — until the person
 * picks one. Components never ask which theme is active: the tokens in
 * `index.css` have a value for each, and the `data-theme` attribute on `<html>`
 * is all that switches them.
 */

export const THEMES = ['light', 'dark'] as const;
export type ResolvedTheme = (typeof THEMES)[number];

/** What the person chose: one of the two themes, or to follow the system's. */
export type ThemePreference = ResolvedTheme | 'system';

/** The attribute on `<html>` the tokens are keyed on. */
export const THEME_ATTRIBUTE = 'data-theme';

/** Where the choice is kept. The same key is read by the inline script in `index.html`. */
export const THEME_STORAGE_KEY = 'craftstock-theme';

/** The media query that says the system asks for a dark interface. */
export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

/** A stored value this build does not know is "no choice made", never an error. */
export function parseThemePreference(stored: string | null): ThemePreference {
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }

  return preference;
}

/** The theme a toggle switches to from the one on screen. */
export function oppositeTheme(theme: ResolvedTheme): ResolvedTheme {
  return theme === 'dark' ? 'light' : 'dark';
}
