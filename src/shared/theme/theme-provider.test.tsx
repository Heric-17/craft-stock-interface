import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { describe, expect, it } from 'vitest';

import { ThemeToggle } from '@/shared/ui/theme-toggle';
import { setSystemColorScheme } from '@/test/viewport';

import { readStoredThemePreference, storeThemePreference } from './theme-storage';
import { ThemeProvider } from './theme-provider';
import { useTheme } from './theme-context';

function Probe() {
  const { theme, preference } = useTheme();

  return (
    <p>
      {theme} / {preference}
    </p>
  );
}

function renderThemed() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
      <Probe />
    </ThemeProvider>,
  );
}

const attribute = () => document.documentElement.getAttribute('data-theme');

describe('the theme', () => {
  it('is light, and says so on the page, when nothing was chosen and the system is light', () => {
    renderThemed();

    expect(attribute()).toBe('light');
    expect(screen.getByText('light / system')).toBeInTheDocument();
  });

  it('follows the system while nothing was chosen, and keeps following it', () => {
    setSystemColorScheme('dark');
    renderThemed();

    expect(attribute()).toBe('dark');

    act(() => setSystemColorScheme('light'));

    expect(attribute()).toBe('light');
  });

  it('switches with one press, says what the next press does, and remembers the choice', async () => {
    const user = userEvent.setup();
    renderThemed();

    await user.click(screen.getByRole('button', { name: 'Mudar para o tema escuro' }));

    expect(attribute()).toBe('dark');
    expect(screen.getByText('dark / dark')).toBeInTheDocument();
    expect(readStoredThemePreference()).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Mudar para o tema claro' }));

    expect(attribute()).toBe('light');
    expect(readStoredThemePreference()).toBe('light');
  });

  it('keeps what the person chose over what the system asks for', () => {
    storeThemePreference('light');
    setSystemColorScheme('dark');
    renderThemed();

    expect(attribute()).toBe('light');
    expect(screen.getByText('light / light')).toBeInTheDocument();

    act(() => setSystemColorScheme('light'));
    act(() => setSystemColorScheme('dark'));

    expect(attribute()).toBe('light');
  });

  it('starts from the choice stored on the last visit', () => {
    storeThemePreference('dark');
    renderThemed();

    expect(attribute()).toBe('dark');
  });
});
