import { afterEach, describe, expect, it, vi } from 'vitest';

import { canShareText, shareText } from './share';

function installShare(share: ((data: ShareData) => Promise<void>) | undefined): void {
  Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: share });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'share');
});

describe('canShareText', () => {
  it('is false where the browser has no share sheet, which is most desktops', () => {
    expect(canShareText()).toBe(false);
  });

  it('is true where it has one', () => {
    installShare(vi.fn(() => Promise.resolve()));

    expect(canShareText()).toBe(true);
  });
});

describe('shareText', () => {
  it('hands the title and the text to the share sheet', async () => {
    const share = vi.fn((_data: ShareData) => Promise.resolve());
    installShare(share);

    await expect(shareText('Lista de compras', 'Cera')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'Lista de compras', text: 'Cera' });
  });

  it('tells closing the sheet without choosing apart from a share that failed', async () => {
    installShare(() => Promise.reject(new DOMException('closed', 'AbortError')));
    await expect(shareText('t', 'x')).resolves.toBe('cancelled');

    installShare(() => Promise.reject(new DOMException('blocked', 'NotAllowedError')));
    await expect(shareText('t', 'x')).resolves.toBe('failed');
  });
});
