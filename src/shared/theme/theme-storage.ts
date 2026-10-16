import { parseThemePreference, THEME_STORAGE_KEY, type ThemePreference } from './theme';

/**
 * The one place the application touches browser storage, and for the one thing
 * it is meant for: a person's preference for the interface. It is not a token,
 * a session or any application state — those live in memory and nowhere else —
 * so this file, and only this file, is exempt from the storage rule.
 *
 * Every access is guarded. Storage can be missing or throw in a private window,
 * with blocked site data or in a preview, and the application has to look right
 * without it: the preference then lives only as long as the page.
 */

export function readStoredThemePreference(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export function storeThemePreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // Not kept for next time; still applied now.
  }
}
