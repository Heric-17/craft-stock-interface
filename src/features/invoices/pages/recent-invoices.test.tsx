import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { env } from '@/shared/config/env';
import { NON_BREAKING_SPACE } from '@/shared/format';
import {
  apiErrorBody,
  compraCasaDasEssencias,
  compraDigitada,
  compraEmbalagensAurora,
  invoicesHandlers,
  purchaseSummaryDto,
} from '@/test/fixtures/invoices';
import { server } from '@/test/msw/server';
import { renderInvoices } from '@/test/render-invoices';
import { VERBATIM } from '@/test/text';
import { PHONE_WIDTH, setViewportWidth } from '@/test/viewport';

const API = env.VITE_API_URL;
const SPACE = NON_BREAKING_SPACE;

async function rowOf(shop: string): Promise<HTMLElement> {
  const link = await screen.findByRole('link', { name: new RegExp(shop) });

  return link.closest('li') ?? link;
}

describe('the recent notes', () => {
  it('names each note by its shop and says when, how many lines, which key and what was paid', async () => {
    server.use(...invoicesHandlers());
    renderInvoices();

    const row = within(await rowOf('Casa das Essências'));

    expect(row.getByText('Casa das Essências')).toBeVisible();
    expect(row.getByText('12 out, 14:20 · 8 itens · Chave 3526…2345')).toBeVisible();
    expect(row.getByText(`R$${SPACE}248,90`, VERBATIM)).toBeVisible();
    // What was paid is under the lines at full price, and the discount is said.
    expect(row.getByText(`desconto R$${SPACE}5,00`, VERBATIM)).toBeVisible();
    expect(row.getByText('Total pago:')).toBeInTheDocument();
  });

  it('says nothing about a discount that was not given', async () => {
    server.use(...invoicesHandlers());
    renderInvoices();

    const row = within(await rowOf('Embalagens Aurora'));

    expect(row.getByText(`R$${SPACE}96,30`, VERBATIM)).toBeVisible();
    expect(row.getByText('9 out, 09:06 · 1 item · Chave 3526…4321')).toBeVisible();
    expect(row.queryByText(/desconto/)).not.toBeInTheDocument();
  });

  it('marks a purchase typed in by hand and one whose discount is still to be attributed', async () => {
    server.use(...invoicesHandlers());
    renderInvoices();

    const row = within(await rowOf('Estabelecimento não identificado'));

    expect(row.getByText('Digitada à mão')).toBeVisible();
    expect(row.getByText('Desconto pendente')).toBeVisible();
    // No note, so no key to show.
    expect(row.getByText('5 out, 12:00 · 3 itens')).toBeVisible();
  });

  it('opens each note at its second step', async () => {
    const user = userEvent.setup();
    server.use(...invoicesHandlers());
    renderInvoices();

    const link = await screen.findByRole('link', { name: /Casa das Essências/ });

    expect(link).toHaveAttribute('href', `/importar-nota/classificar/${compraCasaDasEssencias.id}`);

    await user.click(link);

    expect(
      await screen.findByText(`Tela da classificação da compra ${compraCasaDasEssencias.id}`),
    ).toBeVisible();
  });

  it('shows the last five and counts the whole history with the API total', async () => {
    const requests: URL[] = [];
    const many = Array.from({ length: 12 }, (_, index) =>
      purchaseSummaryDto({
        id: `c${String(index).padStart(3, '0')}`,
        establishment: { id: `loja-${index}`, name: `Loja ${index + 1}`, cnpj: null },
      }),
    );
    server.use(
      ...invoicesHandlers({ purchases: many, onPurchasesRequest: (url) => requests.push(url) }),
    );
    renderInvoices();

    const list = await screen.findByRole('list', { name: 'Notas recentes' });

    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText('Mostrando as 5 mais recentes de 12.')).toBeVisible();
    expect(requests[0]?.searchParams.get('limit')).toBe('5');
    expect(requests[0]?.searchParams.get('offset')).toBe('0');
    // No period: the last ones, whenever they came.
    expect(requests[0]?.searchParams.has('from')).toBe(false);
    expect(screen.getByRole('link', { name: 'Ver todas as notas' })).toHaveAttribute(
      'href',
      '/importar-nota/notas',
    );
  });

  it('counts a short history exactly', async () => {
    server.use(...invoicesHandlers());
    renderInvoices();

    expect(await screen.findByText('3 notas importadas.')).toBeVisible();
  });

  it('never titles a note with something every note would share', async () => {
    server.use(...invoicesHandlers());
    renderInvoices();

    await screen.findByRole('list', { name: 'Notas recentes' });

    expect(screen.queryByText('Nota fiscal')).not.toBeInTheDocument();
  });
});

describe('the four states of the recent notes', () => {
  it('shows a skeleton while the history loads', () => {
    server.use(...invoicesHandlers());
    renderInvoices();

    expect(screen.getAllByRole('status')[0]).toHaveAttribute('aria-busy', 'true');
  });

  it('says what to do when no note was imported, and the action takes the person to the address', async () => {
    const user = userEvent.setup();
    server.use(...invoicesHandlers({ invoices: [], purchases: [] }));
    renderInvoices();

    expect(await screen.findByText('Nenhuma nota importada ainda')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver todas as notas' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Colar o endereço' }));

    expect(screen.getByLabelText('Endereço do QR Code')).toHaveFocus();
  });

  it('shows the support code of an unexpected failure, and tries again on request', async () => {
    const user = userEvent.setup();
    let failing = true;
    server.use(
      http.get(`${API}/purchases`, () =>
        failing
          ? HttpResponse.json(
              apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'err-compras-1' }),
              { status: 500 },
            )
          : HttpResponse.json({ items: [compraEmbalagensAurora], total: 1, limit: 5, offset: 0 }),
      ),
      // No unread note either: its rows have a button of the same name.
      ...invoicesHandlers({ invoices: [] }),
    );
    renderInvoices();

    expect(await screen.findByText('Não foi possível carregar as notas')).toBeInTheDocument();
    expect(screen.getByText('err-compras-1')).toBeInTheDocument();
    expect(screen.queryByText('INTERNAL_ERROR')).not.toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('1 nota importada.')).toBeInTheDocument();
  });

  it('reads the history again on request', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    server.use(...invoicesHandlers({ onPurchasesRequest: (url) => requests.push(url) }));
    renderInvoices();
    await screen.findByText('3 notas importadas.');
    const before = requests.length;

    await user.click(screen.getByRole('button', { name: 'Atualizar lista' }));

    await waitFor(() => {
      expect(requests.length).toBeGreaterThan(before);
    });
  });
});

describe('the recent notes on a phone', () => {
  it('are one list of rows, each a link the whole width, with the amount beside the shop', async () => {
    setViewportWidth(PHONE_WIDTH);
    server.use(...invoicesHandlers({ purchases: [compraCasaDasEssencias, compraDigitada] }));
    renderInvoices();

    const list = await screen.findByRole('list', { name: 'Notas recentes' });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(within(list).getAllByRole('link')).toHaveLength(2);
    expect(within(list).getByText(`R$${SPACE}248,90`, VERBATIM)).toBeVisible();
  });
});
