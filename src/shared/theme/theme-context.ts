import { createContext, useContext } from 'react';

import type { ResolvedTheme, ThemePreference } from './theme';

export interface ThemeContextValue {
  /** What the person chose, or `system` while they have not. */
  preference: ThemePreference;
  /** The theme actually on screen. */
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Switches to the other theme, which is an explicit choice from then on. */
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);

  if (value === null) {
    throw new Error('useTheme must be used inside <ThemeProvider>.');
  }

  return value;
}
