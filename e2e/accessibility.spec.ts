import { expect, test, type Page } from '@playwright/test';

import { createFixtures, type Fixtures } from './support/fixtures';
import { PUBLIC_SCREENS, SCREENS, settle } from './support/screens';
import { signIn } from './support/session';

/**
 * What a person using a keyboard or a screen reader depends on, checked in a real browser:
 * every control has a name, the focus ring can be seen, and a dialog or the drawer keeps the
 * keyboard inside it, closes on Escape and gives the focus back.
 */
let fixtures: Fixtures;

test.beforeAll(async ({ request }) => {
  fixtures = await createFixtures(request);
});

/** Controls on screen that have no accessible name: a field with no label, an icon-only button. */
async function unnamedControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const unnamed: string[] = [];
    const controls = document.body.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]), select, textarea, button, a[href]',
    );

    for (const control of controls) {
      const rect = control.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0 || control.closest('[aria-hidden="true"]')) {
        continue;
      }

      const labelledBy = control.getAttribute('aria-labelledby');
      const referenced =
        labelledBy === null
          ? ''
          : labelledBy
              .split(/\s+/)
              .map((id) => document.getElementById(id)?.textContent ?? '')
              .join('');
      const labels = 'labels' in control ? [...((control as HTMLInputElement).labels ?? [])] : [];
      const name = [
        control.getAttribute('aria-label') ?? '',
        referenced,
        labels.map((label) => label.textContent ?? '').join(''),
        control.textContent ?? '',
        control.getAttribute('title') ?? '',
        control.querySelector('img[alt]')?.getAttribute('alt') ?? '',
      ]
        .join('')
        .trim();

      if (name === '') {
        unnamed.push(
          `${control.tagName.toLowerCase()}${control.id === '' ? '' : `#${control.id}`}`,
        );
      }
    }

    return unnamed;
  });
}

test('every control on every screen has a name', async ({ page }) => {
  test.setTimeout(180_000);
  const missing: string[] = [];

  for (const screen of PUBLIC_SCREENS) {
    await page.goto(screen.path(fixtures));
    await settle(page);
    missing.push(...(await unnamedControls(page)).map((control) => `${screen.name}: ${control}`));
  }

  await signIn(page);

  for (const screen of SCREENS) {
    await page.goto(screen.path(fixtures));
    await settle(page);
    await screen.prepare?.(page, fixtures);
    missing.push(...(await unnamedControls(page)).map((control) => `${screen.name}: ${control}`));
  }

  expect(missing).toEqual([]);
});

test('the keyboard focus can be seen on every control it reaches', async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page);

  const invisible: string[] = [];

  for (const path of ['/insumos', '/vendas/nova', '/fichas-tecnicas/nova', '/configuracoes']) {
    await page.goto(path);
    await settle(page);

    for (let step = 0; step < 25; step += 1) {
      await page.keyboard.press('Tab');

      const state = await page.evaluate(() => {
        const element = document.activeElement;

        if (element === null || element === document.body) {
          return null;
        }

        const style = getComputedStyle(element);
        const hasOutline = style.outlineStyle !== 'none' && style.outlineWidth !== '0px';
        const hasRing = style.boxShadow !== 'none';
        // A stretched link draws its focus on the card it covers, a field on its wrapper.
        const wrapper = element.closest('article') ?? element.parentElement;
        const wrapperRing = wrapper !== null && getComputedStyle(wrapper).boxShadow !== 'none';

        return {
          visible: hasOutline || hasRing || wrapperRing,
          name: `${element.tagName.toLowerCase()} "${(element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 30)}"`,
        };
      });

      if (state !== null && !state.visible) {
        invisible.push(`${path}: ${state.name}`);
      }
    }
  }

  expect(invisible).toEqual([]);
});

test.describe('dialogs keep the keyboard inside them', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, '/insumos');
    await settle(page);
  });

  async function insideDialog(page: Page): Promise<boolean> {
    return page.evaluate(
      () => document.activeElement?.closest('[role="dialog"], [role="alertdialog"]') != null,
    );
  }

  test('the registration panel traps Tab, closes on Escape and returns the focus', async ({
    page,
  }) => {
    const trigger = page.getByRole('button', { name: 'Novo insumo' });
    await trigger.click();
    await expect(page.getByRole('dialog', { name: 'Novo insumo' })).toBeVisible();

    expect(await insideDialog(page)).toBe(true);

    for (let step = 0; step < 30; step += 1) {
      await page.keyboard.press('Tab');
      expect(await insideDialog(page), `Tab ${step + 1} left the dialog`).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Novo insumo' })).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('a confirmation traps the focus and Escape cancels it', async ({ page }) => {
    await page.goto(`/vendas/${fixtures.saleId}`);
    await settle(page);

    const production = page.getByRole('radiogroup', { name: 'Produção' });
    await production.getByRole('radio', { name: 'Montado' }).click();
    const confirmation = page.getByRole('alertdialog');
    await expect(confirmation).toBeVisible();
    expect(await insideDialog(page)).toBe(true);

    await page.keyboard.press('Escape');
    await expect(confirmation).toHaveCount(0);
    // Cancelled: nothing was debited, the axis is where it was.
    await expect(production.getByRole('radio', { name: 'Pendente' })).toBeChecked();
  });

  test('the drawer on a phone traps Tab, closes on Escape and returns the focus', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/insumos');
    await settle(page);

    const trigger = page.getByRole('button', { name: 'Abrir menu' });
    await trigger.click();
    await expect(page.getByRole('navigation', { name: 'Seções' })).toBeVisible();
    expect(await insideDialog(page)).toBe(true);

    for (let step = 0; step < 20; step += 1) {
      await page.keyboard.press('Tab');
      expect(await insideDialog(page), `Tab ${step + 1} left the drawer`).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation', { name: 'Seções' })).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});
