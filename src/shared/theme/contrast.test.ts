/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Read from disk: the test setup turns stylesheet imports into empty modules.
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

/**
 * Text against the surface it is drawn on, in both themes, read straight from the tokens in
 * `index.css`. A status badge is `bg-success-muted text-success`: the pair is what has to be
 * readable, and a token edited for one theme can quietly break it in the other.
 *
 * The threshold is WCAG AA for normal text (4.5:1). Badge text is 12px, so it is not "large".
 */
const AA_NORMAL_TEXT = 4.5;

/** Text token on the surface token it is used with. */
const PAIRS: ReadonlyArray<readonly [text: string, surface: string]> = [
  ['foreground', 'background'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['destructive-foreground', 'destructive-strong'],
  // The five tones of the status badge, the segmented control and the callout.
  ['destructive', 'destructive-muted'],
  ['success', 'success-muted'],
  ['warning', 'warning-muted'],
  ['info', 'info-muted'],
  // The same colours as plain text on the page and on a card.
  ['destructive', 'card'],
  ['success', 'card'],
  ['warning', 'card'],
  ['info', 'card'],
  ['sidebar-foreground', 'sidebar'],
  ['sidebar-muted-foreground', 'sidebar'],
  ['sidebar-accent-foreground', 'sidebar-accent'],
  ['sidebar-primary-foreground', 'sidebar-primary'],
];

function tokensOf(block: RegExp): Map<string, string> {
  const body = block.exec(css)?.[1] ?? '';
  const tokens = new Map<string, string>();

  for (const match of body.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens.set(match[1] ?? '', match[2] ?? '');
  }

  return tokens;
}

function channel(hex: string, offset: number): number {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;

  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const color = hex.replace('#', '');

  return 0.2126 * channel(color, 0) + 0.7152 * channel(color, 2) + 0.0722 * channel(color, 4);
}

function contrast(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);

  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const THEMES = {
  light: tokensOf(/:root\s*\{([^}]*)\}/),
  dark: tokensOf(/:root\[data-theme='dark'\]\s*\{([^}]*)\}/),
} as const;

describe('theme contrast', () => {
  for (const [theme, tokens] of Object.entries(THEMES)) {
    describe(`${theme} theme`, () => {
      it('defines every token the pairs use', () => {
        const names = PAIRS.flat();

        expect(names.filter((name) => !tokens.has(name))).toEqual([]);
      });

      it.each(PAIRS)('%s on %s is readable (AA, 4.5:1)', (text, surface) => {
        const ratio = contrast(tokens.get(text) ?? '#000000', tokens.get(surface) ?? '#ffffff');

        expect(ratio, `${text} on ${surface} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
          AA_NORMAL_TEXT,
        );
      });
    });
  }
});
