import { screen, waitFor, within, type BoundFunctions, type queries } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '@/shared/config/env';
import { NON_BREAKING_SPACE } from '@/shared/format';
import { requireDecimalString } from '@/shared/money';
import { invoicesHandlers } from '@/test/fixtures/invoices';
import {
  apiErrorBody,
  EMPTY_SPENDING,
  MONTHS_OF_SPENDING,
  SPENDING_NOW,
  spendingDatasetDto,
  spendingDatasetFor,
  spendingHandlers,
} from '@/test/fixtures/spending';
import { server } from '@/test/msw/server';
import { renderSpending } from '@/test/render-spending';
import { VERBATIM } from '@/test/text';

const API = env.VITE_API_URL;
const SPACE = NON_BREAKING_SPACE;

const reais = (value: string) => `R$${SPACE}${value}`;

beforeEach(() => {
  // The period and the running month depend on today. Only the date is frozen:
  // timers stay real, so the network still answers.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(SPENDING_NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

function serve(options: Parameters<typeof spendingHandlers>[0] = {}) {
  // The spending route first: `/purchases/:id` would otherwise answer it.
  server.use(...spendingHandlers(options), ...invoicesHandlers());
}

async function cards() {
  return within(await screen.findByRole('region', { name: 'Resumo dos gastos' }));
}

function card(scope: BoundFunctions<typeof queries>, label: string) {
  return within(scope.getByText(label).closest('div.\\@container') as HTMLElement);
}

describe('the spending cards', () => {
  it('give what was paid this month, the ticket, what the discounts saved and how much of it became stock', async () => {
    serve();
    renderSpending();

    const summary = await cards();

    expect(card(summary, 'Total no mês').getByText(reais('1.180,00'), VERBATIM)).toBeVisible();
    // 1.180,00 ÷ 6 purchases, rounded once.
    expect(card(summary, 'Ticket médio').getByText(reais('196,67'), VERBATIM)).toBeVisible();
    expect(card(summary, 'Ticket médio').getByText('6 compras no mês')).toBeVisible();
    expect(
      card(summary, 'Economia em descontos').getByText(reais('112,50'), VERBATIM),
    ).toBeVisible();
    expect(card(summary, 'Insumos de estoque no gasto').getByText('70,0%')).toBeVisible();
  });

  it('say that this month is still running, and compare it with the month before', async () => {
    serve();
    renderSpending();

    const month = card(await cards(), 'Total no mês');

    expect(month.getByText(/outubro de 2026/)).toBeVisible();
    expect(month.getByText(/mês ainda em andamento/)).toBeVisible();
    // 1.180,00 against 1.000,00 in September.
    expect(month.getByText(/\+18,0% contra setembro/)).toBeVisible();
  });

  it('say which stretch each figure covers, so a month and a period are not read as one', async () => {
    serve();
    renderSpending();

    const summary = await cards();

    expect(card(summary, 'Economia em descontos').getByText(/Últimos 6 meses/)).toBeVisible();
    expect(card(summary, 'Insumos de estoque no gasto').getByText(/Últimos 6 meses/)).toBeVisible();
    expect(
      card(summary, 'Insumos de estoque no gasto').getByText(
        `Últimos 6 meses · ${reais('2.191,35')} em insumos de estoque e ${reais('939,15')} só em gasto da empresa`,
        VERBATIM,
      ),
    ).toBeVisible();
  });

  it('call the split what it is, and not a category', async () => {
    serve();
    renderSpending();

    await cards();

    // The only mention is the help, saying that it is not one.
    expect(
      screen.getByText(/Não é uma categoria que você escolhe/, { selector: 'li' }),
    ).toBeVisible();
    expect(screen.queryByText('Maior categoria')).not.toBeInTheDocument();
  });

  it('show a saving of zero as R$ 0,00, a value, when no note had a discount', async () => {
    serve({
      dataset: (from, to) => {
        const base = spendingDatasetFor(from, to);

        return {
          ...base,
          byPeriod: base.byPeriod.map((cell) => ({
            ...cell,
            discountTotal: requireDecimalString('0.00'),
          })),
        };
      },
    });
    renderSpending();

    const economy = card(await cards(), 'Economia em descontos');

    expect(economy.getByText(reais('0,00'), VERBATIM)).toBeVisible();
    expect(economy.queryByText(/sem dados/i)).not.toBeInTheDocument();
  });

  it('say there is no comparison when the month before had no spending, instead of a percentage', async () => {
    serve({
      dataset: () =>
        spendingDatasetDto({
          byPeriod: MONTHS_OF_SPENDING.filter((cell) => cell.period === '2026-10'),
        }),
    });
    renderSpending();

    const month = card(await cards(), 'Total no mês');

    expect(month.getByText(/Sem gastos no mês anterior para comparar/)).toBeVisible();
    expect(month.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('read zero, with no average and no share, for a period with nothing in it', async () => {
    serve({ dataset: () => EMPTY_SPENDING });
    renderSpending();

    const summary = await cards();

    expect(card(summary, 'Total no mês').getByText(reais('0,00'), VERBATIM)).toBeVisible();
    expect(card(summary, 'Ticket médio').getByText('Sem compras')).toBeVisible();
    expect(card(summary, 'Economia em descontos').getByText(reais('0,00'), VERBATIM)).toBeVisible();
    expect(card(summary, 'Insumos de estoque no gasto').getByText('Sem gastos')).toBeVisible();
  });
});

describe('the period', () => {
  it('asks the API for the six months, by month, with the offset of Sao Paulo, from inclusive and to exclusive', async () => {
    const requests: URL[] = [];
    serve({ onRequest: (url) => requests.push(url) });
    renderSpending();
    await cards();

    const sixMonths = requests.find((url) =>
      url.searchParams.get('from')?.startsWith('2026-05-01'),
    );

    expect(sixMonths?.searchParams.get('from')).toBe('2026-05-01T00:00:00-03:00');
    // The first instant of November, never the last day of October.
    expect(sixMonths?.searchParams.get('to')).toBe('2026-11-01T00:00:00-03:00');
    expect(sixMonths?.searchParams.get('granularity')).toBe('MONTH');
  });

  it('reads this month and the one before it for the comparison, whatever the period', async () => {
    const requests: URL[] = [];
    serve({ onRequest: (url) => requests.push(url) });
    renderSpending();
    await cards();

    expect(
      requests.some(
        (url) =>
          url.searchParams.get('from') === '2026-09-01T00:00:00-03:00' &&
          url.searchParams.get('to') === '2026-11-01T00:00:00-03:00',
      ),
    ).toBe(true);
  });

  it('is one of three whole-month choices, and asks the API again for the one picked', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    serve({ onRequest: (url) => requests.push(url) });
    renderSpending();
    await cards();

    const field = screen.getByRole('combobox', { name: 'Período' });

    expect(
      within(field)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Este mês', 'Últimos 6 meses', 'Últimos 12 meses']);

    await user.selectOptions(field, 'LAST_12_MONTHS');

    await waitFor(() =>
      expect(
        requests.some((url) => url.searchParams.get('from') === '2025-11-01T00:00:00-03:00'),
      ).toBe(true),
    );
    expect(requests.at(-1)?.searchParams.get('to')).toBe('2026-11-01T00:00:00-03:00');
  });
});

describe('the monthly chart', () => {
  it('has a row for every month of the period, the month without a purchase at R$ 0,00', async () => {
    serve();
    renderSpending();

    const table = within(await screen.findByRole('table', { name: 'Valor pago por mês' }));
    const rows = table.getAllByRole('row').slice(1);

    expect(rows.map((row) => within(row).getAllByRole('rowheader')[0]?.textContent)).toEqual([
      'maio de 2026',
      'junho de 2026',
      'julho de 2026',
      'agosto de 2026',
      'setembro de 2026',
      'outubro de 2026 (em andamento)',
    ]);
    expect(within(rows[1] as HTMLElement).getByText(reais('0,00'), VERBATIM)).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText('0 compras')).toBeInTheDocument();
    expect(
      within(rows[5] as HTMLElement).getByText(reais('1.180,00'), VERBATIM),
    ).toBeInTheDocument();
  });

  it('marks the running month as partial, in the axis, in the legend and in the table, and no other', async () => {
    serve();
    const { container } = renderSpending();

    await screen.findByRole('table', { name: 'Valor pago por mês' });

    // The legend explains the dashed bar.
    expect(screen.getByText(/Barra tracejada: mês em andamento, ainda incompleto/)).toBeVisible();
    // Under the axis: one "em andamento", under October only.
    const ticks = Array.from(
      container.querySelectorAll('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-label'),
    );

    expect(ticks).toHaveLength(6);
    expect(ticks.filter((tick) => /em andamento/.test(tick.textContent ?? ''))).toHaveLength(1);
    expect(ticks.at(-1)?.textContent).toContain('em andamento');
    // And one bar is drawn dashed.
    expect(
      container.querySelectorAll('.recharts-bar-rectangle path[stroke-dasharray]'),
    ).toHaveLength(1);
  });

  it('writes the amounts over the bars from the Money, formatted, and not from the number that sizes them', async () => {
    serve();
    const { container } = renderSpending();

    await screen.findByRole('table', { name: 'Valor pago por mês' });

    const labels = Array.from(container.querySelectorAll('.recharts-label-list text')).map(
      (label) => label.textContent,
    );

    expect(labels).toEqual([
      reais('300,00'),
      reais('0,00'),
      reais('450,50'),
      reais('200,00'),
      reais('1.000,00'),
      reais('1.180,00'),
    ]);
  });

  it('says there is nothing to draw for a period with no purchase, and offers to import a note', async () => {
    serve({ dataset: () => EMPTY_SPENDING });
    renderSpending();

    const chart = within(await screen.findByRole('region', { name: 'Gastos por mês' }));

    expect(await chart.findByText('Nenhuma compra neste período')).toBeVisible();
    expect(chart.getByRole('link', { name: 'Importar nota' })).toHaveAttribute(
      'href',
      '/importar-nota',
    );
    expect(screen.queryByRole('table', { name: 'Valor pago por mês' })).not.toBeInTheDocument();
  });
});

describe('where you buy', () => {
  async function ranking() {
    return within(await screen.findByRole('region', { name: 'Onde você compra' }));
  }

  it('lists the shops by what was paid, with the purchases and the value', async () => {
    serve();
    renderSpending();

    const shops = await ranking();
    const rows = await shops.findAllByRole('listitem');

    expect(rows).toHaveLength(4);
    expect(within(rows[0] as HTMLElement).getByText('Casa das Essências')).toBeVisible();
    expect(within(rows[0] as HTMLElement).getByText('8 compras')).toBeVisible();
    expect(within(rows[0] as HTMLElement).getByText(reais('1.500,00'), VERBATIM)).toBeVisible();
    expect(within(rows[1] as HTMLElement).getByText('Embalagens Aurora')).toBeVisible();
    // Known only by its CNPJ.
    expect(within(rows[2] as HTMLElement).getByText('11222333000144')).toBeVisible();
  });

  it('opens the list of purchases narrowed to the shop and to the period', async () => {
    serve();
    renderSpending();

    const link = await (await ranking()).findByRole('link', { name: /Casa das Essências/ });

    expect(link).toHaveAttribute('href', '/compras?estabelecimento=12345678000123&periodo=6-meses');
  });

  it('shows purchases with no shop as a row that is not a link, since there is nothing to filter by', async () => {
    serve();
    renderSpending();

    const shops = await ranking();
    const rows = await shops.findAllByRole('listitem');
    const noShop = rows[3] as HTMLElement;

    expect(within(noShop).getByText('Sem estabelecimento')).toBeVisible();
    expect(within(noShop).queryByRole('link')).not.toBeInTheDocument();
  });

  it('says so when no purchase was made in the period', async () => {
    serve({ dataset: () => EMPTY_SPENDING });
    renderSpending();

    expect(await (await ranking()).findByText('Nenhuma compra neste período.')).toBeVisible();
  });
});

describe('the recent purchases', () => {
  async function recent() {
    return within(await screen.findByRole('region', { name: 'Compras recentes' }));
  }

  it('come from the paginated list, five at most, as they are', async () => {
    const urls: URL[] = [];
    serve();
    server.use(
      http.get(`${API}/purchases`, ({ request }) => {
        urls.push(new URL(request.url));

        return HttpResponse.json({ items: [], total: 0, limit: 5, offset: 0 });
      }),
    );
    renderSpending();
    await recent();

    await waitFor(() => expect(urls.length).toBeGreaterThan(0));
    expect(urls[0]?.searchParams.get('limit')).toBe('5');
    expect(urls[0]?.searchParams.get('offset')).toBe('0');
  });

  it('name each by its shop, with the amount paid, and open it at its detail', async () => {
    serve();
    renderSpending();

    const list = await recent();
    const link = await list.findByRole('link', { name: /Casa das Essências/ });

    expect(link).toHaveAttribute('href', '/compras/compra-0001');
    expect(within(link).getByText(reais('248,90'), VERBATIM)).toBeVisible();
  });

  it('mark a purchase whose discount is still to be spread, which is not in the figures above', async () => {
    serve();
    renderSpending();

    const list = await recent();

    expect(await list.findByText('Desconto a distribuir')).toBeVisible();
  });

  it('lead to every purchase through "Ver todas"', async () => {
    serve();
    renderSpending();

    expect((await recent()).getByRole('link', { name: /Ver todas/ })).toHaveAttribute(
      'href',
      '/compras',
    );
  });

  it('say there is no purchase yet, with the way to import a note', async () => {
    serve();
    server.use(
      http.get(`${API}/purchases`, () =>
        HttpResponse.json({ items: [], total: 0, limit: 5, offset: 0 }),
      ),
    );
    renderSpending();

    const list = await recent();

    expect(await list.findByText('Nenhuma compra ainda')).toBeVisible();
    expect(list.getByRole('link', { name: 'Importar nota' })).toHaveAttribute(
      'href',
      '/importar-nota',
    );
  });
});

describe('the help', () => {
  it('says the panel adds up what was paid and that the cost of a material uses the full price', async () => {
    serve();
    renderSpending();

    await cards();

    expect(screen.getByText(/O painel soma o valor pago/)).toBeVisible();
    expect(screen.getByText(/usa o valor cheio da linha, sem desconto/)).toBeVisible();
    expect(screen.getByText(/Não é uma categoria que você escolhe/)).toBeVisible();
  });
});

describe('when it fails', () => {
  it('says the figures could not be loaded, with the support code and a way to try again', async () => {
    const user = userEvent.setup();
    serve({
      failure: {
        status: 500,
        body: apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'err-spending-1' }),
      },
    });
    renderSpending();

    // The cards, the chart and the ranking each say so, and each carries the code.
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('err-spending-1')).length).toBeGreaterThan(0);

    server.resetHandlers();
    serve();
    await user.click(screen.getAllByRole('button', { name: 'Tentar novamente' })[0] as HTMLElement);

    expect(await cards()).toBeDefined();
  });
});

describe('exporting the report', () => {
  function captureDownload() {
    const saved: { name: string; text: Promise<string>; bytes: Promise<Uint8Array> }[] = [];
    const created: Blob[] = [];

    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);

      return 'blob:relatorio';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(
      this: HTMLAnchorElement,
    ) {
      const blob = created.at(-1);

      saved.push({
        name: this.download,
        text: blob?.text() ?? Promise.resolve(''),
        bytes:
          blob?.arrayBuffer().then((buffer) => new Uint8Array(buffer)) ??
          Promise.resolve(new Uint8Array()),
      });
    });

    return saved;
  }

  it('saves a CSV with semicolons and Brazilian amounts, from the dataset on screen', async () => {
    const user = userEvent.setup();
    const saved = captureDownload();
    serve();
    renderSpending();
    await cards();

    const button = screen.getByRole('button', { name: 'Exportar relatório' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(saved).toHaveLength(1);
    expect(saved[0]?.name).toBe('gastos-2026-05-a-2026-10.csv');

    const csv = await saved[0]?.text;

    // The mark that makes a spreadsheet read the accents: the three bytes of the UTF-8
    // byte order mark. `Blob.text()` drops it by the spec, so the bytes are what is read.
    expect(Array.from((await saved[0]?.bytes)?.slice(0, 3) ?? [])).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv).toContain('Mês;Gasto (R$);Economia em descontos (R$);Compras');
    expect(csv).toContain('maio de 2026;300,00;12,00;3');
    expect(csv).toContain('junho de 2026;0,00;0,00;0');
    expect(csv).toContain('outubro de 2026 (em andamento);1180,00;30,50;6');
    expect(csv).toContain('Total do período;3130,50;112,50;20');
    expect(csv).toContain('Casa das Essências;1500,00;60,00;8');
    expect(await screen.findByText('Relatório exportado.')).toBeVisible();
  });

  it('is off until the figures are there', async () => {
    serve();
    renderSpending();

    expect(screen.getByRole('button', { name: 'Exportar relatório' })).toBeDisabled();

    await cards();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Exportar relatório' })).toBeEnabled(),
    );
  });
});
