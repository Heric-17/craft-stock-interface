import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '@/shared/config/env';
import { NON_BREAKING_SPACE } from '@/shared/format';
import { toInt } from '@/shared/lib/to-int';
import {
  compraCasaDasEssencias,
  compraDigitada,
  compraEmbalagensAurora,
  invoicesHandlers,
  purchaseSummaryDto,
} from '@/test/fixtures/invoices';
import { apiErrorBody, SPENDING_NOW } from '@/test/fixtures/spending';
import { server } from '@/test/msw/server';
import { renderSpending } from '@/test/render-spending';
import { VERBATIM } from '@/test/text';

const API = env.VITE_API_URL;
const SPACE = NON_BREAKING_SPACE;

beforeEach(() => {
  // The default period is "the last 12 months", which depends on today. Only the
  // date is frozen: timers stay real, so the network still answers.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(SPENDING_NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

/** Forty-five purchases, newest first, so the list has three pages. */
const MANY = Array.from({ length: 45 }, (_, index) =>
  purchaseSummaryDto({
    id: `compra-${String(index + 1).padStart(4, '0')}`,
    purchaseDate: `2026-10-${String(13 - Math.floor(index / 5)).padStart(2, '0')}T15:00:00.000Z`,
    establishment: { id: `loja-${index + 1}`, name: `Loja ${index + 1}`, cnpj: null },
  }),
);

async function list(label = 'Compras') {
  return within(await screen.findByRole('list', { name: label }));
}

describe('the purchases list', () => {
  it('shows every purchase with its shop, day and what was paid, and the discount where there was one', async () => {
    server.use(...invoicesHandlers());
    renderSpending('/compras');

    const purchases = await list();
    const casa = within(await purchases.findByRole('link', { name: /^Casa das Essências/ }));

    expect(casa.getByText(`R$${SPACE}248,90`, VERBATIM)).toBeVisible();
    expect(casa.getByText(`desconto R$${SPACE}5,00`, VERBATIM)).toBeVisible();
    expect(purchases.getByRole('link', { name: /^Embalagens Aurora/ })).toBeVisible();
  });

  it('says how many purchases there are in the period, from the API’s total', async () => {
    server.use(...invoicesHandlers());
    renderSpending('/compras');

    expect(await screen.findByText('3 compras no período')).toBeVisible();
  });

  it('opens each purchase at its detail', async () => {
    const user = userEvent.setup();
    server.use(...invoicesHandlers());
    renderSpending('/compras');

    const link = await (await list()).findByRole('link', { name: /^Casa das Essências/ });

    expect(link).toHaveAttribute('href', `/compras/${compraCasaDasEssencias.id}`);

    await user.click(link);

    // Past the list: the detail asks the API for the purchase, which these handlers do not know.
    expect(await screen.findByRole('link', { name: /Voltar para as compras/ })).toBeVisible();
  });

  it('marks a purchase whose discount is still to be spread, and says it is not in the figures', async () => {
    server.use(...invoicesHandlers());
    renderSpending('/compras');

    const purchases = await list();
    const row = within(
      (await purchases.findByRole('link', { name: /^Estabelecimento não identificado/ })).closest(
        'li',
      ) as HTMLElement,
    );

    expect(row.getByText('Desconto a distribuir')).toBeVisible();
    expect(
      screen.getByText(/esta compra não entra nos números do painel de gastos/, { exact: false }),
    ).toBeVisible();
    expect(compraDigitada.allocationPending).toBe(true);
  });

  it('keeps the purchase with its discount to spread out of the explanation when none on the page has one', async () => {
    server.use(
      ...invoicesHandlers({ purchases: [compraCasaDasEssencias, compraEmbalagensAurora] }),
    );
    renderSpending('/compras');

    await list();

    expect(screen.queryByText('Desconto a distribuir')).not.toBeInTheDocument();
  });

  it('says there is nothing in the period, with the way to import a note', async () => {
    server.use(...invoicesHandlers({ purchases: [] }));
    renderSpending('/compras');

    expect(await screen.findByText('Nenhuma compra neste período')).toBeVisible();
    // The header's way to import and the empty state's own action go to the same place.
    const links = screen.getAllByRole('link', { name: 'Importar nota' });

    expect(links.length).toBeGreaterThan(1);
    expect(links.every((link) => link.getAttribute('href') === '/importar-nota')).toBe(true);
  });

  it('says it could not load, with the support code and a way to try again', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API}/purchases`, () =>
        HttpResponse.json(
          apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'err-purchases-1' }),
          { status: 500 },
        ),
      ),
    );
    renderSpending('/compras');

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('Não foi possível carregar as compras');
    expect(alert).toHaveTextContent('err-purchases-1');

    server.use(...invoicesHandlers());
    await user.click(within(alert).getByRole('button', { name: 'Tentar novamente' }));

    expect(await list()).toBeDefined();
  });
});

describe('classifying from the list', () => {
  it('has a button on each purchase that leads to its classification, apart from opening its detail', async () => {
    const user = userEvent.setup();
    server.use(...invoicesHandlers());
    renderSpending('/compras');

    const purchases = await list();
    const row = within(
      (await purchases.findByRole('link', { name: /^Casa das Essências/ })).closest(
        'li',
      ) as HTMLElement,
    );
    const classify = row.getByRole('link', { name: /Classificar/ });

    expect(classify).toHaveAttribute(
      'href',
      `/importar-nota/classificar/${compraCasaDasEssencias.id}`,
    );
    // The row itself still opens the detail, and the button is not inside that link.
    const detail = row.getByRole('link', { name: /^Casa das Essências/ });

    expect(detail).toHaveAttribute('href', `/compras/${compraCasaDasEssencias.id}`);
    expect(detail).not.toContainElement(classify);
    expect(purchases.getAllByRole('link', { name: /Classificar/ })).toHaveLength(3);

    await user.click(classify);

    expect(
      await screen.findByText(`Tela da classificação da compra ${compraCasaDasEssencias.id}`),
    ).toBeVisible();
  });

  it('says which purchase the button is for, to a screen reader that hears the buttons one after another', async () => {
    server.use(...invoicesHandlers());
    renderSpending('/compras');

    expect(
      await screen.findByRole('link', { name: 'Classificar compra de Casa das Essências' }),
    ).toBeVisible();
  });
});

describe('the period of the purchases', () => {
  it('is the last 12 months until another is picked, sent as instants with the offset of Sao Paulo', async () => {
    const urls: URL[] = [];
    server.use(...invoicesHandlers({ onPurchasesRequest: (url) => urls.push(url) }));
    renderSpending('/compras');
    await list();

    expect(screen.getByRole('combobox', { name: 'Data da compra' })).toHaveValue('LAST_12_MONTHS');
    expect(urls[0]?.searchParams.get('from')).toBe('2025-11-01T00:00:00-03:00');
    expect(urls[0]?.searchParams.get('to')).toBe('2026-11-01T00:00:00-03:00');
  });

  it('narrows by asking the API again, not by hiding rows', async () => {
    const user = userEvent.setup();
    const urls: URL[] = [];
    server.use(
      ...invoicesHandlers({
        purchases: [
          purchaseSummaryDto({
            id: 'compra-velha',
            purchaseDate: '2026-03-10T15:00:00.000Z',
            establishment: { id: 'x', name: 'Loja Antiga', cnpj: null },
          }),
          purchaseSummaryDto({
            id: 'compra-nova',
            purchaseDate: '2026-10-12T15:00:00.000Z',
            establishment: { id: 'y', name: 'Loja de Hoje', cnpj: null },
          }),
        ],
        onPurchasesRequest: (url) => urls.push(url),
      }),
    );
    renderSpending('/compras');
    expect(await screen.findByText('2 compras no período')).toBeVisible();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Data da compra' }),
      'THIS_MONTH',
    );

    expect(await screen.findByText('1 compra no período')).toBeVisible();
    expect(screen.queryByText('Loja Antiga')).not.toBeInTheDocument();
    expect(urls.at(-1)?.searchParams.get('from')).toBe('2026-10-01T00:00:00-03:00');
  });

  it('asks for both days before it asks the API, when the period is typed in', async () => {
    const user = userEvent.setup();
    const urls: URL[] = [];
    server.use(...invoicesHandlers({ onPurchasesRequest: (url) => urls.push(url) }));
    renderSpending('/compras');
    await list();
    const before = urls.length;

    await user.selectOptions(screen.getByRole('combobox', { name: 'Data da compra' }), 'CUSTOM');

    expect(screen.getByText(/Escolha o primeiro e o último dia do período/)).toBeVisible();
    expect(urls.length).toBe(before);
  });
});

describe('the pages of the purchases', () => {
  it('count from the API’s total and not from the rows on the page', async () => {
    server.use(...invoicesHandlers({ purchases: MANY }));
    renderSpending('/compras');

    // Twenty rows are on screen, and the list says there are forty-five.
    expect(await screen.findByText('45 compras no período')).toBeVisible();
    expect((await list()).getAllByRole('listitem')).toHaveLength(20);
    expect(screen.getByText('1–20 de 45')).toBeVisible();
  });

  it('go forward and back a page at a time, asking the API for each by its offset', async () => {
    const user = userEvent.setup();
    const offsets: (string | null)[] = [];
    server.use(
      ...invoicesHandlers({
        purchases: MANY,
        onPurchasesRequest: (url) => offsets.push(url.searchParams.get('offset')),
      }),
    );
    renderSpending('/compras');
    await screen.findByText('1–20 de 45');

    await user.click(screen.getByRole('button', { name: /Próxima/ }));

    expect(await screen.findByText('21–40 de 45')).toBeVisible();
    expect(offsets.at(-1)).toBe('20');

    await user.click(screen.getByRole('button', { name: /Próxima/ }));

    expect(await screen.findByText('41–45 de 45')).toBeVisible();
    expect((await list()).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByRole('button', { name: /Próxima/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Anterior/ }));

    expect(await screen.findByText('21–40 de 45')).toBeVisible();
    expect(offsets.at(-1)).toBe('20');
  });

  it('start over from the first page when the period changes', async () => {
    const user = userEvent.setup();
    server.use(...invoicesHandlers({ purchases: MANY }));
    renderSpending('/compras');
    await screen.findByText('1–20 de 45');

    await user.click(screen.getByRole('button', { name: /Próxima/ }));
    await screen.findByText('21–40 de 45');

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Data da compra' }),
      'LAST_6_MONTHS',
    );

    expect(await screen.findByText('1–20 de 45')).toBeVisible();
  });

  it('never ask for more than the API allows', async () => {
    const limits: (string | null)[] = [];
    server.use(
      ...invoicesHandlers({
        purchases: MANY,
        onPurchasesRequest: (url) => limits.push(url.searchParams.get('limit')),
      }),
    );
    renderSpending('/compras');
    await screen.findByText('1–20 de 45');

    expect(limits.every((limit) => (toInt(limit) ?? Infinity) <= 100)).toBe(true);
  });
});

describe('the purchases of one shop', () => {
  it('are what a row of the ranking opens: the shop and the period go to the API as its parameters', async () => {
    const urls: URL[] = [];
    server.use(...invoicesHandlers({ onPurchasesRequest: (url) => urls.push(url) }));
    renderSpending('/compras?estabelecimento=98765432000199&periodo=6-meses');

    const purchases = await list();

    expect(await purchases.findByRole('link', { name: /^Embalagens Aurora/ })).toBeVisible();
    expect(purchases.queryByRole('link', { name: /^Casa das Essências/ })).not.toBeInTheDocument();
    expect(await screen.findByText('1 compra no período')).toBeVisible();

    const request = urls.at(-1);

    expect(request?.searchParams.get('establishmentId')).toBe('98765432000199');
    // The six months of the ranking, cut the way the API reads them.
    expect(request?.searchParams.get('from')).toBe('2026-05-01T00:00:00-03:00');
    expect(request?.searchParams.get('to')).toBe('2026-11-01T00:00:00-03:00');
  });

  it('start with the period of the ranking, and let it be changed', async () => {
    server.use(...invoicesHandlers());
    renderSpending('/compras?estabelecimento=98765432000199&periodo=este-mes');

    expect(await screen.findByRole('combobox', { name: 'Data da compra' })).toHaveValue(
      'THIS_MONTH',
    );
  });

  it('say which shop the list is narrowed to, and take the filter off', async () => {
    const user = userEvent.setup();
    const urls: URL[] = [];
    server.use(...invoicesHandlers({ onPurchasesRequest: (url) => urls.push(url) }));
    const { router } = renderSpending('/compras?estabelecimento=98765432000199&periodo=6-meses');

    const clear = await screen.findByRole('button', { name: /Só Embalagens Aurora/ });

    await user.click(clear);

    await waitFor(() => expect(urls.at(-1)?.searchParams.has('establishmentId')).toBe(false));
    expect(await screen.findByText('3 compras no período')).toBeVisible();
    // The period stays in the address; only the shop went.
    expect(router.state.location.search).toBe('?periodo=6-meses');
  });

  it('say so, and offer every shop, when the one chosen has nothing in the period', async () => {
    const user = userEvent.setup();
    server.use(...invoicesHandlers());
    renderSpending('/compras?estabelecimento=00000000000000&periodo=6-meses');

    expect(await screen.findByText('Nenhuma compra neste período')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Ver todos os estabelecimentos' }));

    expect(await screen.findByText('3 compras no período')).toBeVisible();
  });

  it('leads back to the spending panel', async () => {
    server.use(...invoicesHandlers());
    renderSpending('/compras');

    expect(await screen.findByRole('link', { name: /Gastos da empresa/ })).toHaveAttribute(
      'href',
      '/gastos',
    );
  });
});
