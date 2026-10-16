import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useMediaQuery } from '@/shared/lib/use-media-query';

import {
  oppositeTheme,
  resolveTheme,
  SYSTEM_DARK_QUERY,
  THEME_ATTRIBUTE,
  type ThemePreference,
} from './theme';
import { ThemeContext, type ThemeContextValue } from './theme-context';
import { readStoredThemePreference, storeThemePreference } from './theme-storage';

/**
 * Holds the theme and puts it on `<html>`. That attribute is the whole
 * mechanism: the tokens in `index.css` have a value per theme, so nothing else
 * has to know which one is active, and a component never branches on it.
 *
 * Until the person chooses, the theme follows the system's, and keeps following
 * it as it changes.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredThemePreference);
  const systemPrefersDark = useMediaQuery(SYSTEM_DARK_QUERY);
  const theme = resolveTheme(preference, systemPrefersDark);

  useEffect(() => {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  }, [theme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    storeThemePreference(next);
  }, []);

  const toggleTheme = useCallback(
    () => setPreference(oppositeTheme(theme)),
    [setPreference, theme],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, theme, setPreference, toggleTheme }),
    [preference, theme, setPreference, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
