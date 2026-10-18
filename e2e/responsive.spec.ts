import { expect, test } from '@playwright/test';

import { createFixtures, type Fixtures } from './support/fixtures';
import { measureLayout, type LayoutReport } from './support/layout';
import { PUBLIC_SCREENS, SCREENS, settle } from './support/screens';
import { signIn } from './support/session';

/**
 * Layout, measured in a real browser at the widths the interface is built for (360, 768 and
 * 1280, and 320 as the floor). jsdom has no layout,
 * so this is the only place "no sideways scroll" and "44px targets" can be checked for real.
 *
 * Every screen is opened with content in it: an empty screen hides what overflows.
 */
const WIDTHS = [320, 360, 768, 1280] as const;

/** Below this width the interface is the phone one: a drawer, cards, a summary on top. */
const PHONE_MAX_WIDTH = 767;

interface Finding {
  screen: string;
  width: number;
  report: LayoutReport;
}

/** The lines a person fixing the layout needs: which screen, which width, which element. */
function problems(finding: Finding): string[] {
  const { screen, width, report } = finding;
  const lines: string[] = [];

  if (report.pageOverflow > 0) {
    lines.push(`${screen} @${width}: the page scrolls sideways by ${report.pageOverflow}px`);
  }

  for (const offender of report.offenders) {
    lines.push(`${screen} @${width}: sticks out of the screen: ${offender}`);
  }

  // Touch targets matter where the finger is: the phone widths.
  if (width <= PHONE_MAX_WIDTH) {
    for (const target of report.smallTargets) {
      lines.push(`${screen} @${width}: target under 44px: ${target}`);
    }
  }

  return lines;
}

let fixtures: Fixtures;

test.beforeAll(async ({ request }) => {
  fixtures = await createFixtures(request);
});

for (const width of WIDTHS) {
  test(`signed-in screens at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height: 800 });
    await signIn(page);

    const findings: Finding[] = [];

    for (const screen of SCREENS) {
      await page.goto(screen.path(fixtures));
      await settle(page);
      await screen.prepare?.(page, fixtures);
      await page.waitForTimeout(350); // a sheet slides in

      findings.push({ screen: screen.name, width, report: await measureLayout(page) });
    }

    if (width <= PHONE_MAX_WIDTH) {
      await page.goto('/insumos');
      await settle(page);
      await page.getByRole('button', { name: 'Abrir menu' }).click();
      await expect(page.getByRole('navigation', { name: 'Seções' })).toBeVisible();
      await page.waitForTimeout(350);
      findings.push({ screen: 'Menu (gaveta)', width, report: await measureLayout(page) });
    }

    await testInfo.attach(`layout-${width}.json`, {
      body: JSON.stringify(findings, null, 2),
      contentType: 'application/json',
    });

    expect(findings.flatMap(problems)).toEqual([]);
  });
}

for (const width of [320, 360] as const) {
  test(`public screens at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });

    const findings: Finding[] = [];

    for (const screen of PUBLIC_SCREENS) {
      await page.goto(screen.path(fixtures));
      await settle(page);

      findings.push({ screen: screen.name, width, report: await measureLayout(page) });
    }

    expect(findings.flatMap(problems)).toEqual([]);
  });
}
