import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { env } from '@/shared/config/env';
import { NON_BREAKING_SPACE } from '@/shared/format';
import { toIntOr } from '@/shared/lib/to-int';
import { materialsHandlers } from '@/test/fixtures/materials';
import {
  apiErrorBody,
  saleDto,
  salesHandlers,
  vendaAna,
  vendaJoao,
  vendaMarina,
} from '@/test/fixtures/sales';
import { server } from '@/test/msw/server';
import { renderSales } from '@/test/render-sales';
import { VERBATIM } from '@/test/text';
import { PHONE_WIDTH, setViewportWidth } from '@/test/viewport';

const API = env.VITE_API_URL;
const SPACE = NON_BREAKING_SPACE;

function rowOf(customer: string): HTMLElement {
  const link = screen.getByRole('link', { name: new RegExp(customer) });

  return link.closest('tr') ?? link.closest('li') ?? link;
}

describe('the sales history', () => {
  it('shows who bought, what, for how much and how far along, from the API', async () => {
    server.use(...salesHandlers(), ...materialsHandlers());
    renderSales();

    await screen.findByRole('link', { name: /Marina Souza/ });
    const row = within(rowOf('Marina Souza'));

    expect(row.getByText('Venda aaaa1111')).toBeInTheDocument();
    expect(row.getByText(`R$${SPACE}24,03`, VERBATIM)).toBeInTheDocument();
    expect(row.getByText(/12 out.*11:32/)).toBeInTheDocument();
    // One seal per axis, each saying which axis it is for.
    expect(row.getByText('Pagamento:', { exact: false })).toBeInTheDocument();
    expect(row.getByText('Produção:', { exact: false })).toBeInTheDocument();
  });

  it('summarises the items by the name they were sold under, not the product as it is today', async () => {
    server.use(...salesHandlers(), ...materialsHandlers());
    renderSales();

    await screen.findByRole('link', { name: /Marina Souza/ });
    const row = within(rowOf('Marina Souza'));

    // The product is called "Vela de baunilha" today; the sale remembers the day it was sold.
    expect(row.getByText(/Vela Baunilha Clássica/)).toBeInTheDocument();
    expect(row.queryByText(/Vela de baunilha/)).not.toBeInTheDocument();
    expect(row.getByText(/Cera de soja/)).toBeInTheDocument();
  });

  it('gives each axis its own seal, so a paid and delivered sale and an unpaid one read differently', async () => {
    server.use(...salesHandlers(), ...materialsHandlers());
    renderSales();

    await screen.findByRole('link', { name: /Ana Lima/ });

    const ana = within(rowOf('Ana Lima'));
    expect(ana.getByText('Pago')).toBeInTheDocument();
    expect(ana.getByText('Entregue')).toBeInTheDocument();

    const marina = within(rowOf('Marina Souza'));
    expect(marina.getAllByText('Pendente')).toHaveLength(2);
    expect(marina.queryByText('Pago')).not.toBeInTheDocument();

    const joao = within(rowOf('João Pereira'));
    expect(joao.getByText('Pago')).toBeInTheDocument();
    expect(joao.getByText('Montado')).toBeInTheDocument();
  });

  it('opens each sale, and offers a new one', async () => {
    server.use(...salesHandlers(), ...materialsHandlers());
    renderSales();

    const link = await screen.findByRole('link', { name: /Marina Souza/ });

    expect(link).toHaveAttribute('href', `/vendas/${vendaMarina.id}`);
    expect(screen.getByRole('link', { name: 'Nova venda' })).toHaveAttribute(
      'href',
      '/vendas/nova',
    );
  });

  it('has no combined status anywhere: two filters, two columns, no "status" word', async () => {
    server.use(...salesHandlers(), ...materialsHandlers());
    renderSales();

    await screen.findByRole('link', { name: /Marina Souza/ });

    expect(screen.getByRole('combobox', { name: 'Pagamento' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Produção' })).toBeInTheDocument();
    // Each card says which axis each seal is for, in a label beside it.
    const card = within(rowOf('Marina Souza'));
    expect(card.getByText('Pagamento')).toBeInTheDocument();
    expect(card.getByText('Produção')).toBeInTheDocument();
    expect(screen.queryByText(/status/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Todos os status')).not.toBeInTheDocument();
  });
});

describe('the two filters', () => {
  it('are independent, go to the API as parameters and leave the other axis alone', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    server.use(
      ...salesHandlers({
        onRequest: (url) => url.pathname.endsWith('/sales') && requests.push(url),
      }),
      ...materialsHandlers(),
    );
    renderSales();

    await screen.findByRole('link', { name: /Marina Souza/ });
    expect(requests[0]?.searchParams.has('paymentStatus')).toBe(false);
    expect(requests[0]?.searchParams.has('productionStatus')).toBe(false);

    // Payment only: João (paid, assembled) and Ana (paid, delivered).
    await user.selectOptions(screen.getByRole('combobox', { name: 'Pagamento' }), 'PAID');
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /Marina Souza/ })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /João Pereira/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ana Lima/ })).toBeInTheDocument();
    expect(requests.at(-1)?.searchParams.get('paymentStatus')).toBe('PAID');
    expect(requests.at(-1)?.searchParams.has('productionStatus')).toBe(false);

    // Production on top of it: only João is paid and assembled.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Produção' }), 'ASSEMBLED');
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /Ana Lima/ })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /João Pereira/ })).toBeInTheDocument();
    expect(requests.at(-1)?.searchParams.get('paymentStatus')).toBe('PAID');
    expect(requests.at(-1)?.searchParams.get('productionStatus')).toBe('ASSEMBLED');

    // Taking the payment filter off leaves the production one where it was.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Pagamento' }), '');
    await waitFor(() => {
      expect(requests.at(-1)?.searchParams.has('paymentStatus')).toBe(false);
    });
    expect(requests.at(-1)?.searchParams.get('productionStatus')).toBe('ASSEMBLED');
    expect(screen.getByRole('combobox', { name: 'Produção' })).toHaveValue('ASSEMBLED');
  });

  it('count the sales with the API total, not with the rows on the screen', async () => {
    const user = userEvent.setup();
    server.use(
      ...salesHandlers({
        sales: [
          ...Array.from({ length: 3 }, (_, index) =>
            saleDto({
              id: `pago${index}000-0000-4000-8000-000000000000`,
              customerName: `Cliente pago ${index + 1}`,
              paymentStatus: 'PAID',
            }),
          ),
          vendaMarina,
        ],
      }),
      ...materialsHandlers(),
    );
    renderSales();

    expect(await screen.findByText('4 vendas')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Pagamento' }), 'PAID');

    expect(await screen.findByText('3 vendas')).toBeInTheDocument();
  });

  it('say so when nothing matches, and clear with one action', async () => {
    const user = userEvent.setup();
    server.use(...salesHandlers({ sales: [vendaMarina] }), ...materialsHandlers());
    renderSales();

    await screen.findByRole('link', { name: /Marina Souza/ });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Pagamento' }), 'PAID');

    expect(await screen.findByText('Nenhuma venda encontrada')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0]!);

    expect(await screen.findByRole('link', { name: /Marina Souza/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Pagamento' })).toHaveValue('');
  });

  it('survive a reload, because they live in the address', async () => {
    server.use(...salesHandlers(), ...materialsHandlers());
    renderSales('/vendas?pagamento=PAID&producao=DELIVERED');

    expect(await screen.findByRole('link', { name: /Ana Lima/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /João Pereira/ })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Pagamento' })).toHaveValue('PAID');
    expect(screen.getByRole('combobox', { name: 'Produção' })).toHaveValue('DELIVERED');
  });
});

describe('the pagination', () => {
  const many = Array.from({ length: 45 }, (_, index) =>
    saleDto({
      id: `s${String(index).padStart(3, '0')}0000-0000-4000-8000-000000000000`,
      customerName: `Cliente ${String(index + 1).padStart(2, '0')}`,
    }),
  );

  it('counts the whole history, shows a page of it and never asks for more than the API allows', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    server.use(
      ...salesHandlers({
        sales: many,
        onRequest: (url) => url.pathname.endsWith('/sales') && requests.push(url),
      }),
      ...materialsHandlers(),
    );
    renderSales();

    expect(await screen.findByText('45 vendas')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Cliente \d\d/ })).toHaveLength(20);
    expect(screen.getByText('1–20 de 45')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Próxima/ }));

    expect(await screen.findByText('21–40 de 45')).toBeInTheDocument();
    expect(requests.at(-1)?.searchParams.get('offset')).toBe('20');
    expect(requests.every((url) => toIntOr(url.searchParams.get('limit'), 0) <= 100)).toBe(true);
  });
});

describe('the cards at the top', () => {
  it('say which kind of number each one is: movement of the month, or balance still open', async () => {
    server.use(...salesHandlers(), ...materialsHandlers());
    renderSales();

    const cards = within(await screen.findByRole('region', { name: 'Resumo das vendas' }));

    // Movement: this month's cell, against last month's.
    expect(cards.getByText('Vendas no mês')).toBeInTheDocument();
    expect(cards.getByText(`R$${SPACE}2.071,00`, VERBATIM)).toBeInTheDocument();
    expect(
      cards.getByText(/Movimento do mês atual · \+12,5% contra o mês anterior/),
    ).toBeInTheDocument();

    // Balance: the open sales, whatever their date.
    expect(cards.getByText('Pedidos em produção')).toBeInTheDocument();
    expect(cards.getByText('7')).toBeInTheDocument();
    expect(cards.getByText('A receber')).toBeInTheDocument();
    expect(cards.getByText(`R$${SPACE}485,30`, VERBATIM)).toBeInTheDocument();
    expect(cards.getAllByText(/Saldo atual/)).toHaveLength(2);
  });

  it('read the open sales for the balance, not the period status cells that would say R$ 90,00', async () => {
    server.use(...salesHandlers(), ...materialsHandlers());
    renderSales();

    const cards = within(await screen.findByRole('region', { name: 'Resumo das vendas' }));

    expect(cards.queryByText(`R$${SPACE}90,00`, VERBATIM)).not.toBeInTheDocument();
  });

  it('ask the API for this month and the one before it, with the Sao Paulo offset', async () => {
    const requests: URL[] = [];
    server.use(
      ...salesHandlers({
        onRequest: (url) => url.pathname.endsWith('/analytics') && requests.push(url),
      }),
      ...materialsHandlers(),
    );
    renderSales();

    await screen.findByRole('region', { name: 'Resumo das vendas' });

    const from = requests[0]?.searchParams.get('from') ?? '';
    const to = requests[0]?.searchParams.get('to') ?? '';
    expect(from).toMatch(/^\d{4}-\d{2}-01T00:00:00-0[23]:00$/);
    expect(to).toMatch(/^\d{4}-\d{2}-01T00:00:00-0[23]:00$/);
    expect(new Date(to).getTime()).toBeGreaterThan(new Date(from).getTime());
  });

  it('show a quiet month as R$ 0,00 and say there is nothing to compare with', async () => {
    server.use(
      ...salesHandlers({
        dataset: (from, to) => ({
          from,
          to,
          byMonth: [],
          byPaymentStatus: [],
          byProductionStatus: [],
          openItems: [],
        }),
      }),
      ...materialsHandlers(),
    );
    renderSales();

    const cards = within(await screen.findByRole('region', { name: 'Resumo das vendas' }));

    expect(cards.getAllByText(`R$${SPACE}0,00`, VERBATIM)).toHaveLength(2);
    expect(cards.getByText('0')).toBeInTheDocument();
    expect(cards.getByText(/Sem mês anterior para comparar/)).toBeInTheDocument();
  });

  it('do not invent a delivery forecast, which the model has no date for', async () => {
    server.use(...salesHandlers(), ...materialsHandlers());
    renderSales();

    await screen.findByRole('region', { name: 'Resumo das vendas' });

    expect(screen.queryByText(/para entregar hoje/i)).not.toBeInTheDocument();
  });

  it('fail on their own, without taking the list with them', async () => {
    // An override goes first: the first handler that matches answers.
    server.use(
      http.get(`${API}/sales/analytics`, () =>
        HttpResponse.json(
          apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'err-dataset' }),
          { status: 500 },
        ),
      ),
      ...salesHandlers(),
      ...materialsHandlers(),
    );
    renderSales();

    expect(
      await screen.findByText('Não foi possível carregar os números das vendas'),
    ).toBeInTheDocument();
    expect(screen.getByText('err-dataset')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Marina Souza/ })).toBeInTheDocument();
  });
});

describe('the four states', () => {
  it('shows a skeleton while the list loads', () => {
    server.use(...salesHandlers(), ...materialsHandlers());
    renderSales();

    expect(screen.getAllByRole('status')[0]).toHaveAttribute('aria-busy', 'true');
  });

  it('says what to do when there is no sale yet', async () => {
    server.use(...salesHandlers({ sales: [] }), ...materialsHandlers());
    renderSales();

    expect(await screen.findByText('Nenhuma venda registrada')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Nova venda' })).toHaveLength(2);
  });

  it('shows the support code of an unexpected failure, and tries again on request', async () => {
    const user = userEvent.setup();
    let failing = true;
    server.use(
      http.get(`${API}/sales`, () =>
        failing
          ? HttpResponse.json(
              apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'err-sales-1' }),
              { status: 500 },
            )
          : HttpResponse.json({ items: [vendaMarina], total: 1, limit: 20, offset: 0 }),
      ),
      ...salesHandlers(),
      ...materialsHandlers(),
    );
    renderSales();

    expect(await screen.findByText('Não foi possível carregar as vendas')).toBeInTheDocument();
    expect(screen.getByText('err-sales-1')).toBeInTheDocument();
    expect(screen.queryByText('INTERNAL_ERROR')).not.toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByRole('link', { name: /Marina Souza/ })).toBeInTheDocument();
  });
});

describe('the sales history on a phone', () => {
  it('is a list of cards with both filters and the main action within reach', async () => {
    setViewportWidth(PHONE_WIDTH);
    server.use(...salesHandlers(), ...materialsHandlers());
    renderSales();

    await screen.findByRole('link', { name: /Ana Lima/ });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const card = within(rowOf('Ana Lima'));
    expect(card.getByText('Pagamento')).toBeInTheDocument();
    expect(card.getByText('Produção')).toBeInTheDocument();
    expect(card.getByText(`R$${SPACE}11,40`, VERBATIM)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Pagamento' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Produção' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nova venda' })).toBeInTheDocument();
    // The history stays one list of cards: a sale is one card, not a row to scroll sideways.
    expect(screen.getByRole('list', { name: 'Vendas' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Vendas' })).getAllByRole('article'),
    ).toHaveLength([vendaMarina, vendaJoao, vendaAna].length);
  });
});
