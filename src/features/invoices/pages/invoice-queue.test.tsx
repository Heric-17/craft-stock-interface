import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { env } from '@/shared/config/env';
import {
  apiErrorBody,
  capturaIlegivel,
  capturaInstavel,
  capturaProcessando,
  invoicesHandlers,
} from '@/test/fixtures/invoices';
import { server } from '@/test/msw/server';
import { renderInvoices } from '@/test/render-invoices';
import { PHONE_WIDTH, setViewportWidth } from '@/test/viewport';

const API = env.VITE_API_URL;

/** The row of the queue that holds a given text, found by what it says and not by its position. */
async function rowWith(text: string | RegExp): Promise<HTMLElement> {
  const list = await screen.findByRole('list', { name: 'Notas aguardando leitura' });
  const item = within(list)
    .getAllByRole('listitem')
    .find((candidate) =>
      typeof text === 'string'
        ? candidate.textContent.includes(text)
        : text.test(candidate.textContent),
    );

  if (item === undefined) {
    throw new Error(`No row of the queue says ${String(text)}.`);
  }

  return item;
}

describe('the notes waiting to be read', () => {
  it('is not on the screen when every note sent has been read', async () => {
    server.use(...invoicesHandlers({ invoices: [] }));
    renderInvoices();

    await screen.findByRole('list', { name: 'Notas recentes' });

    expect(screen.queryByText('Notas aguardando leitura')).not.toBeInTheDocument();
  });

  it('asks the API for each status a note can be stuck in, a hundred at most, and never for the imported', async () => {
    const requests: URL[] = [];
    server.use(...invoicesHandlers({ onRequest: (url) => requests.push(url) }));
    renderInvoices();
    await rowWith('Portal instável');

    const statuses = requests.map((url) => url.searchParams.get('status')).sort();

    expect(statuses).toEqual(['PENDING', 'UNSTABLE']);
    expect(requests.every((url) => url.searchParams.get('limit') === '100')).toBe(true);
  });

  it('names a note by when it was sent, not by a title every note would share', async () => {
    server.use(...invoicesHandlers({ invoices: [capturaInstavel, capturaIlegivel] }));
    renderInvoices();

    const unstable = within(await rowWith('Portal instável'));
    expect(unstable.getByText('Enviada 12 out, 09:05')).toBeVisible();
    expect(unstable.getByText('3 tentativas · última 12 out, 09:06')).toBeVisible();

    const unreadable = within(await rowWith('Portal alterado'));
    expect(unreadable.getByText('Enviada 11 out, 07:15')).toBeVisible();
    expect(unreadable.getByText('1 tentativa · última 11 out, 07:16')).toBeVisible();

    expect(screen.queryByText('Nota fiscal')).not.toBeInTheDocument();
  });

  it('puts the newest first, whichever status it is stuck in', async () => {
    server.use(...invoicesHandlers({ invoices: [capturaIlegivel, capturaInstavel] }));
    renderInvoices();

    const list = await screen.findByRole('list', { name: 'Notas aguardando leitura' });
    const rows = within(list).getAllByRole('listitem');

    // The portal-down note was sent on the 12th, the unreadable one on the 11th.
    expect(rows[0]).toHaveTextContent('Portal instável');
    expect(rows[1]).toHaveTextContent('Portal alterado');
  });

  it('says where each note stands, with a seal and what can be done about it', async () => {
    server.use(
      ...invoicesHandlers({ invoices: [capturaInstavel, capturaIlegivel, capturaProcessando()] }),
    );
    renderInvoices();

    const unstable = within(await rowWith('Portal instável'));
    expect(unstable.getByText(/O portal da SEFAZ não respondeu/)).toBeVisible();
    expect(unstable.getByRole('button', { name: 'Tentar novamente' })).toBeEnabled();

    const processing = within(await rowWith('Processando'));
    expect(processing.getByText('Primeira leitura em andamento')).toBeVisible();
    expect(processing.getByText(/Estamos lendo a nota/)).toBeVisible();
    // Nothing to do but wait: no retry on a note that is being read.
    expect(processing.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/Acompanhando as notas em processamento/)).toBeInTheDocument();
  });

  it('says the support has to act when the portal changed, with the code to send', async () => {
    server.use(...invoicesHandlers({ invoices: [capturaIlegivel] }));
    renderInvoices();

    const row = within(await rowWith('Portal alterado'));

    expect(row.getByText(/o suporte precisa ajustar o sistema/)).toBeVisible();
    expect(row.getByText('Envie este código para o suporte')).toBeVisible();
    expect(row.getByText(capturaIlegivel.id)).toBeVisible();
    expect(row.getByRole('button', { name: 'Copiar código' })).toBeVisible();
  });

  it('shows no code on a note that only needs another try', async () => {
    server.use(...invoicesHandlers({ invoices: [capturaInstavel] }));
    renderInvoices();

    const row = within(await rowWith('Portal instável'));

    expect(row.queryByText('Envie este código para o suporte')).not.toBeInTheDocument();
  });

  it('never shows what the API keeps for its own log: the reason of the failure, the address, the raw status', async () => {
    server.use(...invoicesHandlers({ invoices: [capturaInstavel, capturaIlegivel] }));
    renderInvoices();

    await rowWith('Portal instável');

    expect(screen.queryByText(/NFC-e source/)).not.toBeInTheDocument();
    expect(screen.queryByText(/The page is not a note/)).not.toBeInTheDocument();
    expect(screen.queryByText(/nfce\.fazenda/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/UNSTABLE|PENDING|IMPORTED|STRUCTURE_CHANGED/),
    ).not.toBeInTheDocument();
  });

  it('says how many are not shown when the queue is longer than a page can hold', async () => {
    server.use(
      http.get(`${API}/invoices/pending`, ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');

        return HttpResponse.json({
          items: status === 'UNSTABLE' ? [capturaInstavel] : [],
          total: status === 'UNSTABLE' ? 104 : 0,
          limit: 100,
          offset: 0,
        });
      }),
      ...invoicesHandlers({ invoices: [] }),
    );
    renderInvoices();

    expect(
      await screen.findByText('Mostrando as 1 mais recentes. Há mais 103 guardadas.'),
    ).toBeVisible();
  });

  it('shows the support code of an unexpected failure to read the queue, and tries again on request', async () => {
    const user = userEvent.setup();
    let failing = true;
    server.use(
      http.get(`${API}/invoices/pending`, () =>
        failing
          ? HttpResponse.json(
              apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'err-fila-1' }),
              { status: 500 },
            )
          : HttpResponse.json({ items: [capturaInstavel], total: 1, limit: 100, offset: 0 }),
      ),
      ...invoicesHandlers({ invoices: [] }),
    );
    renderInvoices();

    expect(
      await screen.findByText('Não foi possível carregar as notas aguardando leitura'),
    ).toBeInTheDocument();
    expect(screen.getByText('err-fila-1')).toBeInTheDocument();
    expect(screen.queryByText('INTERNAL_ERROR')).not.toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await rowWith('Portal instável')).toBeVisible();
  });
});

describe('trying again', () => {
  it('reprocesses the note, and it leaves the queue once it has been read', async () => {
    const user = userEvent.setup();
    const reprocessed: string[] = [];
    server.use(
      ...invoicesHandlers({
        invoices: [capturaInstavel],
        onReprocess: (id) => reprocessed.push(id),
      }),
    );
    renderInvoices();

    await user.click(
      within(await rowWith('Portal instável')).getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(
      await screen.findByText('Nota importada. Já dá para classificar os itens.'),
    ).toBeInTheDocument();
    expect(reprocessed).toEqual([capturaInstavel.id]);
    // It is a purchase now, and the history is where it is: the waiting list is empty again.
    await waitFor(() => {
      expect(screen.queryByText('Notas aguardando leitura')).not.toBeInTheDocument();
    });
  });

  it('asks for the history again once a note was read, because a purchase was created', async () => {
    const user = userEvent.setup();
    const purchaseRequests: URL[] = [];
    server.use(
      ...invoicesHandlers({
        invoices: [capturaInstavel],
        onPurchasesRequest: (url) => purchaseRequests.push(url),
      }),
    );
    renderInvoices();
    await screen.findByRole('list', { name: 'Notas recentes' });
    const before = purchaseRequests.length;

    await user.click(
      within(await rowWith('Portal instável')).getByRole('button', { name: 'Tentar novamente' }),
    );

    await waitFor(() => {
      expect(purchaseRequests.length).toBeGreaterThan(before);
    });
  });

  it('shows the button as busy and refuses a second press while the note is being read again', async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      http.post(`${API}/invoices/pending/:id/reprocess`, async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 150));

        return HttpResponse.json({ purchaseId: 'compra-3', merchantName: null });
      }),
      ...invoicesHandlers({ invoices: [capturaInstavel] }),
    );
    renderInvoices();

    await user.click(
      within(await rowWith('Portal instável')).getByRole('button', { name: 'Tentar novamente' }),
    );

    const busy = await screen.findByRole('button', { name: 'Tentando…' });
    expect(busy).toBeDisabled();
    await user.click(busy);

    await waitFor(() => {
      expect(calls).toBe(1);
    });
  });

  it('keeps the note and says the portal is still down, without a code to report', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/invoices/pending/:id/reprocess`, () =>
        HttpResponse.json(
          apiErrorBody(503, 'INVOICE_SOURCE_UNAVAILABLE', undefined, { errorId: 'err-portal-2' }),
          { status: 503 },
        ),
      ),
      ...invoicesHandlers({ invoices: [capturaInstavel] }),
    );
    renderInvoices();

    const row = within(await rowWith('Portal instável'));
    await user.click(row.getByRole('button', { name: 'Tentar novamente' }));

    expect(
      await row.findByText(/A nota ficou na fila e pode ser tentada de novo/),
    ).toBeInTheDocument();
    expect(row.queryByText('err-portal-2')).not.toBeInTheDocument();
    expect(row.getByRole('button', { name: 'Tentar novamente' })).toBeEnabled();
  });

  it('shows the code of the attempt that failed when the portal is still unreadable', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/invoices/pending/:id/reprocess`, () =>
        HttpResponse.json(
          apiErrorBody(502, 'INVOICE_STRUCTURE_CHANGED', undefined, { errorId: 'err-estrutura-9' }),
          { status: 502 },
        ),
      ),
      ...invoicesHandlers({ invoices: [capturaIlegivel] }),
    );
    renderInvoices();

    const row = within(await rowWith('Portal alterado'));
    await user.click(row.getByRole('button', { name: 'Tentar novamente' }));

    expect(await row.findByText('err-estrutura-9')).toBeInTheDocument();
  });

  it('leads to the note that was already imported when the retry finds it', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/invoices/pending/:id/reprocess`, () =>
        HttpResponse.json(
          apiErrorBody(409, 'DUPLICATE_INVOICE', {
            accessKey: '35241012345678000123650010000012341000012345',
            existingPurchaseId: 'compra-ja-existe',
          }),
          { status: 409 },
        ),
      ),
      ...invoicesHandlers({ invoices: [capturaInstavel] }),
    );
    renderInvoices();

    const row = within(await rowWith('Portal instável'));
    await user.click(row.getByRole('button', { name: 'Tentar novamente' }));

    expect(await row.findByText('Esta nota já foi importada.')).toBeInTheDocument();
    expect(row.getByRole('link', { name: /Abrir a nota importada/ })).toHaveAttribute(
      'href',
      '/importar-nota/classificar/compra-ja-existe',
    );
  });
});

describe('the waiting notes on a phone', () => {
  it('are one list of rows, each with its action within reach', async () => {
    setViewportWidth(PHONE_WIDTH);
    server.use(...invoicesHandlers());
    renderInvoices();

    const list = await screen.findByRole('list', { name: 'Notas aguardando leitura' });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getAllByRole('button', { name: 'Tentar novamente' })).toHaveLength(2);
  });
});
