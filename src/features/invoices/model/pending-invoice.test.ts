import { describe, expect, it } from 'vitest';

import type { PendingInvoicePageDto } from '../api/invoice.dto';

import {
  deriveInvoiceState,
  hasProcessingInvoice,
  PROCESSING_TIMEOUT_MS,
  toPendingInvoicePage,
  type InvoiceStateInput,
} from './pending-invoice';

const NOW = new Date('2026-10-15T15:00:00.000Z');

function captured(secondsAgo: number): string {
  return new Date(NOW.getTime() - secondsAgo * 1000).toISOString();
}

function input(overrides: Partial<InvoiceStateInput>): InvoiceStateInput {
  return { status: 'PENDING', attemptCount: 0, createdAt: captured(10), ...overrides };
}

describe('deriveInvoiceState', () => {
  it('reads a note imported as imported, whatever else it carries', () => {
    expect(deriveInvoiceState(input({ status: 'IMPORTED', attemptCount: 3 }), NOW)).toBe(
      'IMPORTED',
    );
  });

  it('reads UNSTABLE as the portal not answering', () => {
    expect(deriveInvoiceState(input({ status: 'UNSTABLE', attemptCount: 3 }), NOW)).toBe(
      'SOURCE_UNAVAILABLE',
    );
  });

  it('reads PENDING with no attempt on record as a note being read right now', () => {
    expect(deriveInvoiceState(input({ status: 'PENDING', attemptCount: 0 }), NOW)).toBe(
      'PROCESSING',
    );
  });

  it('reads PENDING with an attempt on record as a portal the reader could not make sense of', () => {
    // The API parks a capture there on purpose: the portal answered, the reading failed.
    expect(deriveInvoiceState(input({ status: 'PENDING', attemptCount: 1 }), NOW)).toBe(
      'STRUCTURE_CHANGED',
    );
  });

  it('stops believing a capture is processing once it has waited longer than an import can take', () => {
    const justInside = captured(PROCESSING_TIMEOUT_MS / 1000 - 1);
    const justOutside = captured(PROCESSING_TIMEOUT_MS / 1000 + 1);

    expect(deriveInvoiceState(input({ createdAt: justInside }), NOW)).toBe('PROCESSING');
    expect(deriveInvoiceState(input({ createdAt: justOutside }), NOW)).toBe('STALLED');
  });
});

describe('hasProcessingInvoice', () => {
  it('is true while at least one note on the page is being read', () => {
    expect(
      hasProcessingInvoice(
        [input({ status: 'IMPORTED' }), input({ status: 'PENDING', attemptCount: 0 })],
        NOW,
      ),
    ).toBe(true);
  });

  it('is false when nothing is: imported, parked by the portal, unreadable or stalled', () => {
    expect(
      hasProcessingInvoice(
        [
          input({ status: 'IMPORTED' }),
          input({ status: 'UNSTABLE', attemptCount: 3 }),
          input({ status: 'PENDING', attemptCount: 1 }),
          input({ createdAt: captured(PROCESSING_TIMEOUT_MS / 1000 + 60) }),
        ],
        NOW,
      ),
    ).toBe(false);
  });

  it('is false for an empty queue', () => {
    expect(hasProcessingInvoice([], NOW)).toBe(false);
  });
});

describe('toPendingInvoicePage', () => {
  it('keeps the API counts and drops what the screen never reads', () => {
    const dto: PendingInvoicePageDto = {
      items: [
        {
          id: 'cap-1',
          url: 'https://portal.example/nota?p=1',
          status: 'UNSTABLE',
          attemptCount: 2,
          lastAttemptAt: '2026-10-12T12:06:00.000Z',
          purchaseId: null,
          lastError: 'The NFC-e source did not answer.',
          createdAt: '2026-10-12T12:05:00.000Z',
        },
      ],
      total: 41,
      limit: 20,
      offset: 40,
    };

    const page = toPendingInvoicePage(dto);

    expect(page).toEqual({
      items: [
        {
          id: 'cap-1',
          status: 'UNSTABLE',
          attemptCount: 2,
          createdAt: '2026-10-12T12:05:00.000Z',
          lastAttemptAt: '2026-10-12T12:06:00.000Z',
          purchaseId: null,
        },
      ],
      total: 41,
      limit: 20,
      offset: 40,
    });
    // The reason of the failure is English and for the log: it never reaches the screen.
    expect(page.items[0]).not.toHaveProperty('lastError');
    expect(page.items[0]).not.toHaveProperty('url');
  });
});
