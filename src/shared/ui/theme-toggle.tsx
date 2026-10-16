import { Moon, Sun } from 'lucide-react';

import { cn } from '@/shared/lib/cn';
import { useTheme } from '@/shared/theme';

/**
 * Switches between the light and the dark theme. It reads the theme only to say
 * what a press will do — the icon and the label — and never to choose a colour:
 * the colours follow from the tokens.
 *
 * Both icons are drawn and the theme's own tokens hide one of them through
 * `data-theme`, so the button is right on the first paint too.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const label = theme === 'dark' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={toggleTheme}
      className={cn(
        'text-muted-foreground hover:bg-accent hover:text-accent-foreground grid size-11 shrink-0 place-items-center rounded-md transition-colors',
        className,
      )}
    >
      <Sun aria-hidden="true" className="size-5 not-in-data-[theme=dark]:hidden" />
      <Moon aria-hidden="true" className="size-5 in-data-[theme=dark]:hidden" />
    </button>
  );
}
