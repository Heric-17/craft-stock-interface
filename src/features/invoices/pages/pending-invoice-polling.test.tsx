import { screen, within } from '@testing-library/react';
import { act } from 'react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '@/shared/config/env';
import { capturaInstavel, capturaProcessando, invoicesHandlers } from '@/test/fixtures/invoices';
import { server } from '@/test/msw/server';
import { renderInvoices } from '@/test/render-invoices';

import { POLL_INTERVAL_MS, PROCESSING_TIMEOUT_MS } from '../model/pending-invoice';

const API = env.VITE_API_URL;

/**
 * Real time keeps running under the fake clock, so the network of MSW and the
 * cache answer as they do in a browser; only the five-second wait is skipped.
 */
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

type Capture = ReturnType<typeof capturaProcessando>;

/**
 * A queue the test can change under the screen. `reads` counts how often the
 * notes that can be *processing* were asked for — the `PENDING` ones — which is
 * the only read the polling is about.
 */
function watchedQueue(items: Capture[]) {
  const queue = { items, reads: 0 };

  server.use(
    http.get(`${API}/invoices/pending`, ({ request }) => {
      const status = new URL(request.url).searchParams.get('status');

      if (status === 'PENDING') {
        queue.reads += 1;
      }

      const shown = queue.items.filter((invoice) => invoice.status === status);

      return HttpResponse.json({ items: shown, total: shown.length, limit: 100, offset: 0 });
    }),
    ...invoicesHandlers({ invoices: [], purchases: [] }),
  );

  return queue;
}

async function elapse(milliseconds: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

async function untilReads(queue: { reads: number }, expected: number): Promise<void> {
  // The request leaves on the tick and the answer comes back on real time.
  await vi.waitFor(() => {
    expect(queue.reads).toBe(expected);
  });
}

async function waitingList(): Promise<HTMLElement> {
  return screen.findByRole('list', { name: 'Notas aguardando leitura' });
}

describe('the polling of the queue', () => {
  it('reads the queue again every five seconds while a note is being processed', async () => {
    const queue = watchedQueue([capturaProcessando()]);
    renderInvoices();

    expect(within(await waitingList()).getByText('Processando')).toBeInTheDocument();
    expect(screen.getByText(/Acompanhando as notas em processamento/)).toBeInTheDocument();
    await untilReads(queue, 1);

    await elapse(POLL_INTERVAL_MS);
    await untilReads(queue, 2);

    await elapse(POLL_INTERVAL_MS);
    await untilReads(queue, 3);
  });

  it('stops by itself the moment nothing is being processed, and never polls again', async () => {
    const queue = watchedQueue([capturaProcessando()]);
    renderInvoices();
    await waitingList();
    await untilReads(queue, 1);

    // The portal answered: the note was read, and is a purchase, no longer in the queue.
    queue.items = [];
    await elapse(POLL_INTERVAL_MS);
    await untilReads(queue, 2);
    await vi.waitFor(() => {
      expect(screen.queryByText('Notas aguardando leitura')).not.toBeInTheDocument();
    });

    await elapse(POLL_INTERVAL_MS * 6);

    expect(queue.reads).toBe(2);
  });

  it('does not poll at all when no note is being processed', async () => {
    const queue = watchedQueue([capturaInstavel]);
    renderInvoices();
    await waitingList();
    await untilReads(queue, 1);

    await elapse(POLL_INTERVAL_MS * 6);

    expect(queue.reads).toBe(1);
  });

  it('does not poll when the queue is empty', async () => {
    const queue = watchedQueue([]);
    renderInvoices();
    await screen.findByText('Nenhuma nota importada ainda');
    await untilReads(queue, 1);

    await elapse(POLL_INTERVAL_MS * 6);

    expect(queue.reads).toBe(1);
  });

  it('does not poll for a note that has been waiting longer than an import can take, and offers to try it again', async () => {
    const stalled = capturaProcessando({
      createdAt: new Date(Date.now() - PROCESSING_TIMEOUT_MS - 60_000).toISOString(),
    });
    const queue = watchedQueue([stalled]);
    renderInvoices();

    const list = await waitingList();
    expect(within(list).getByText('Sem resposta')).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
    await untilReads(queue, 1);

    await elapse(POLL_INTERVAL_MS * 6);

    expect(queue.reads).toBe(1);
  });

  it('turns a processing note into one without an answer on its own, when it has waited too long', async () => {
    const queue = watchedQueue([
      capturaProcessando({
        createdAt: new Date(Date.now() - PROCESSING_TIMEOUT_MS + 20_000).toISOString(),
      }),
    ]);
    renderInvoices();
    const list = await waitingList();
    expect(within(list).getByText('Processando')).toBeInTheDocument();
    await untilReads(queue, 1);

    // The API keeps saying "pending"; only the clock has moved.
    await elapse(PROCESSING_TIMEOUT_MS);

    expect(await within(list).findByText('Sem resposta')).toBeInTheDocument();
  });
});
