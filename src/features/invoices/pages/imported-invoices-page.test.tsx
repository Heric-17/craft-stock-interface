import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { toIntOr } from '@/shared/lib/to-int';
import {
  compraCasaDasEssencias,
  compraEmbalagensAurora,
  invoicesHandlers,
  purchaseSummaryDto,
} from '@/test/fixtures/invoices';
import { server } from '@/test/msw/server';
import { renderInvoices } from '@/test/render-invoices';

const HISTORY = '/importar-nota/notas';

/** A purchase made a hundred days ago: inside a year, outside this month and the last six. */
const OLD = new Date(Date.now() - 100 * 86_400_000).toISOString();

describe('the screen of every imported note', () => {
  it('lists the notes of the last year, each by its shop, newest first, and counts them with the API total', async () => {
    const requests: URL[] = [];
    server.use(
      ...invoicesHandlers({
        purchases: [compraCasaDasEssencias, compraEmbalagensAurora],
        onPurchasesRequest: (url) => requests.push(url),
      }),
    );
    renderInvoices(HISTORY);

    expect(
      await screen.findByRole('heading', { name: 'Notas importadas', level: 1 }),
    ).toBeVisible();
    const list = await screen.findByRole('list', { name: 'Notas importadas' });

    const rows = within(list).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Casa das Essências');
    expect(rows[1]).toHaveTextContent('Embalagens Aurora');
    expect(screen.getByText('2 notas no período')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Data da nota' })).toHaveValue('LAST_12_MONTHS');
    // The period goes to the API as instants with the offset of Sao Paulo, from inclusive to exclusive.
    const from = requests[0]?.searchParams.get('from') ?? '';
    const to = requests[0]?.searchParams.get('to') ?? '';
    expect(from).toMatch(/^\d{4}-\d{2}-01T00:00:00-0[23]:00$/);
    expect(to).toMatch(/^\d{4}-\d{2}-01T00:00:00-0[23]:00$/);
  });

  it('narrows to the period the person picks, by asking the API and not by hiding rows', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    server.use(
      ...invoicesHandlers({
        purchases: [
          purchaseSummaryDto({
            id: 'compra-velha',
            purchaseDate: OLD,
            establishment: { id: 'x', name: 'Loja Antiga', cnpj: null },
          }),
          purchaseSummaryDto({
            id: 'compra-nova',
            purchaseDate: new Date().toISOString(),
            establishment: { id: 'y', name: 'Loja de Hoje', cnpj: null },
          }),
        ],
        onPurchasesRequest: (url) => requests.push(url),
      }),
    );
    renderInvoices(HISTORY);
    expect(await screen.findByText('2 notas no período')).toBeVisible();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Data da nota' }), 'THIS_MONTH');

    expect(await screen.findByText('1 nota no período')).toBeVisible();
    expect(screen.queryByText('Loja Antiga')).not.toBeInTheDocument();
    expect(screen.getByText('Loja de Hoje')).toBeVisible();
    expect(requests.at(-1)?.searchParams.get('from')).not.toBe(
      requests[0]?.searchParams.get('from'),
    );
  });

  it('says so when the period holds no note, and leads to importing one', async () => {
    server.use(...invoicesHandlers({ purchases: [] }));
    renderInvoices(HISTORY);

    expect(await screen.findByText('Nenhuma nota neste período')).toBeVisible();
    // The header's way back and the empty state's own action both go to the capture screen.
    const links = screen.getAllByRole('link', { name: 'Importar nota' });
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.getAttribute('href') === '/importar-nota')).toBe(true);
  });

  it('asks for both days before it asks the API, when the period is typed in', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    server.use(...invoicesHandlers({ onPurchasesRequest: (url) => requests.push(url) }));
    renderInvoices(HISTORY);
    await screen.findByRole('list', { name: 'Notas importadas' });
    const before = requests.length;

    await user.selectOptions(screen.getByRole('combobox', { name: 'Data da nota' }), 'CUSTOM');

    expect(screen.getByText(/Escolha o primeiro e o último dia do período/)).toBeVisible();
    expect(requests.length).toBe(before);
  });

  it('opens a note at its second step, and goes back to importing', async () => {
    const user = userEvent.setup();
    server.use(...invoicesHandlers({ purchases: [compraCasaDasEssencias] }));
    renderInvoices(HISTORY);

    await user.click(await screen.findByRole('link', { name: /Casa das Essências/ }));

    expect(
      await screen.findByText(`Tela da classificação da compra ${compraCasaDasEssencias.id}`),
    ).toBeVisible();
  });

  it('goes back to the capture screen from the header', async () => {
    const user = userEvent.setup();
    server.use(...invoicesHandlers());
    const { router } = renderInvoices(HISTORY);
    await screen.findByRole('list', { name: 'Notas importadas' });

    await user.click(screen.getAllByRole('link', { name: /Importar nota/ })[0]!);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/importar-nota');
    });
    expect(await screen.findByRole('heading', { name: 'Importar nota fiscal' })).toBeVisible();
  });
});

describe('the pagination of every imported note', () => {
  const many = Array.from({ length: 45 }, (_, index) =>
    purchaseSummaryDto({
      id: `c${String(index).padStart(3, '0')}`,
      establishment: {
        id: `loja-${index}`,
        name: `Loja ${String(index + 1).padStart(2, '0')}`,
        cnpj: null,
      },
    }),
  );

  it('counts the whole history, shows a page of it and never asks for more than the API allows', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    server.use(
      ...invoicesHandlers({ purchases: many, onPurchasesRequest: (url) => requests.push(url) }),
    );
    renderInvoices(HISTORY);

    expect(await screen.findByText('45 notas no período')).toBeVisible();
    expect(
      within(screen.getByRole('list', { name: 'Notas importadas' })).getAllByRole('listitem'),
    ).toHaveLength(20);
    expect(screen.getByText('1–20 de 45')).toBeVisible();

    await user.click(screen.getByRole('button', { name: /Próxima/ }));

    expect(await screen.findByText('21–40 de 45')).toBeVisible();
    expect(requests.at(-1)?.searchParams.get('offset')).toBe('20');
    expect(requests.every((url) => toIntOr(url.searchParams.get('limit'), 0) <= 100)).toBe(true);
  });

  it('goes back to the first page when the period changes', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    server.use(
      ...invoicesHandlers({ purchases: many, onPurchasesRequest: (url) => requests.push(url) }),
    );
    renderInvoices(HISTORY);
    await screen.findByText('45 notas no período');
    await user.click(screen.getByRole('button', { name: /Próxima/ }));
    await screen.findByText('21–40 de 45');

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Data da nota' }),
      'LAST_6_MONTHS',
    );

    await waitFor(() => {
      expect(requests.at(-1)?.searchParams.get('offset')).toBe('0');
    });
  });
});
