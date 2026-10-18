import type { Page } from '@playwright/test';

/** The smallest side a touch target may have, in CSS pixels. */
export const MIN_TOUCH_TARGET = 44;

export interface LayoutReport {
  /** `scrollWidth - clientWidth` of the document: above zero, the page scrolls sideways. */
  pageOverflow: number;
  /** Elements that stick out of the viewport and are not inside a box that scrolls or clips. */
  offenders: string[];
  /** Controls smaller than the touch target, in a form a person can find on screen. */
  smallTargets: string[];
}

/**
 * Measures what jsdom cannot: real layout. Run in the page, so it sees the sizes the browser
 * computed, and returns plain strings for the report.
 */
export async function measureLayout(page: Page): Promise<LayoutReport> {
  return page.evaluate((minTarget) => {
    const viewportWidth = document.documentElement.clientWidth;

    function describe(element: Element): string {
      const label =
        element.getAttribute('aria-label') ??
        (element as HTMLElement).innerText?.trim().replace(/\s+/g, ' ').slice(0, 40) ??
        '';
      const role = element.getAttribute('role');
      const rect = element.getBoundingClientRect();
      const kind =
        role === null ? element.tagName.toLowerCase() : `${element.tagName.toLowerCase()}[${role}]`;

      return `${kind} "${label}" ${Math.round(rect.width)}x${Math.round(rect.height)}`;
    }

    function isShown(element: Element): boolean {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0 &&
        element.closest('[aria-hidden="true"]') === null
      );
    }

    /** Whether a box between the element and the page scrolls or clips it sideways. */
    function containedByScroller(element: Element): boolean {
      for (let node = element.parentElement; node !== null; node = node.parentElement) {
        if (node === document.body || node === document.documentElement) {
          return false;
        }

        const overflowX = getComputedStyle(node).overflowX;

        if (overflowX !== 'visible') {
          return true;
        }
      }

      return false;
    }

    const offenders: string[] = [];

    for (const element of document.body.querySelectorAll('*')) {
      if (!isShown(element) || element.closest('[data-sonner-toaster]') !== null) {
        continue;
      }

      const rect = element.getBoundingClientRect();

      if (rect.right > viewportWidth + 0.5 && !containedByScroller(element)) {
        offenders.push(describe(element));
      }
    }

    const smallTargets: string[] = [];
    const selector =
      'a[href], button, select, textarea, input:not([type="hidden"]), [role="radio"], [role="checkbox"], [role="tab"], [role="switch"], [role="menuitem"]';

    /**
     * The box a finger actually lands on. A link stretched over its card with an absolutely
     * positioned `::after` is as big as the card; a checkbox inside a `label` is as big as
     * the label. Measuring the bare element would call both too small.
     */
    function hitArea(element: HTMLElement): DOMRect {
      const label = element.closest('label');

      if (element instanceof HTMLInputElement && label !== null) {
        return label.getBoundingClientRect();
      }

      const after = getComputedStyle(element, '::after');

      if (after.position === 'absolute' && after.content !== 'none') {
        const box =
          getComputedStyle(element).position === 'static' ? element.offsetParent : element;

        if (box !== null) {
          return box.getBoundingClientRect();
        }
      }

      return element.getBoundingClientRect();
    }

    for (const element of document.body.querySelectorAll<HTMLElement>(selector)) {
      if (!isShown(element) || element.closest('[data-sonner-toaster]') !== null) {
        continue;
      }

      const style = getComputedStyle(element);
      const own = element.getBoundingClientRect();

      // Visually hidden on purpose (the skip link before it is focused, a file input behind
      // its button): not on screen, so not a target.
      if (
        style.clip === 'rect(0px, 0px, 0px, 0px)' ||
        style.clipPath.startsWith('inset(50%') ||
        (own.width <= 1 && own.height <= 1)
      ) {
        continue;
      }

      // A link inside a sentence is text, not a target of its own (WCAG 2.5.8 exception).
      if (element.tagName === 'A' && style.display === 'inline') {
        continue;
      }

      const area = hitArea(element);

      if (area.height < minTarget - 0.5 || area.width < minTarget - 0.5) {
        smallTargets.push(describe(element));
      }
    }

    return {
      pageOverflow: document.documentElement.scrollWidth - viewportWidth,
      offenders: offenders.slice(0, 12),
      smallTargets,
    };
  }, MIN_TOUCH_TARGET);
}
