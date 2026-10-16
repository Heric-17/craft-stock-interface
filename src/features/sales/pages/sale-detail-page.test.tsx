import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { QUERY_ROOTS } from '@/shared/api/query-roots';
import { env } from '@/shared/config/env';
import { NON_BREAKING_SPACE } from '@/shared/format';
import { compositeProductsHandlers } from '@/test/fixtures/composite-products';
import { cera, materialsHandlers } from '@/test/fixtures/materials';
import {
  apiErrorBody,
  ceraAvulsa,
  saleDto,
  salesHandlers,
  snapshotVela,
  vendaAna,
  vendaJoao,
  vendaMarina,
} from '@/test/fixtures/sales';
import { server } from '@/test/msw/server';
import { renderSales } from '@/test/render-sales';
import { VERBATIM } from '@/test/text';
import { PHONE_WIDTH, setViewportWidth } from '@/test/viewport';
import { requireDecimalString as dec } from '@/shared/money';

const API = env.VITE_API_URL;
const SPACE = NON_BREAKING_SPACE;

afterEach(() => {
  server.events.removeAllListeners();
});

/** Every request that is not a read: what the screen asked the API to change. */
function trackWrites(): { method: string; path: string }[] {
  const writes: { method: string; path: string }[] = [];

  server.events.on('request:start', ({ request }) => {
    if (request.method !== 'GET') {
      writes.push({ method: request.method, path: new URL(request.url).pathname });
    }
  });

  return writes;
}

function group(name: 'Pagamento' | 'Produção') {
  return within(screen.getByRole('radiogroup', { name }));
}

/**
 * A sale the API keeps between requests: what a write answers is also what the
 * next read answers, as the real thing does. Without it the refetch after a
 * change would bring the old sale back and the screen would be right to show it.
 */
function mutableSale(initial: ReturnType<typeof saleDto>) {
  let current = initial;

  return {
    change: (next: ReturnType<typeof saleDto>) => {
      current = next;

      return HttpResponse.json(next);
    },
    handlers: [http.get(`${API}/sales/${initial.id}`, () => HttpResponse.json(current))],
  };
}

async function openSale(
  sale = vendaMarina,
  extra: Parameters<typeof server.use> = [],
  onWrite?: (write: { path: string; body: unknown }) => void,
) {
  const materialRequests: URL[] = [];
  server.use(
    ...extra,
    ...salesHandlers({ ...(onWrite === undefined ? {} : { onWrite }) }),
    ...materialsHandlers({
      onRequest: (url) => url.pathname === '/materials' && materialRequests.push(url),
    }),
    ...compositeProductsHandlers(),
  );
  const view = renderSales(`/vendas/${sale.id}`);

  await screen.findByRole('heading', { name: sale.customerName, level: 1 });

  return { ...view, materialRequests };
}

describe('the items of a sale', () => {
  it('show the name and the price they were sold with, even when the product has changed since', async () => {
    await openSale();
    const items = within(screen.getByRole('list', { name: 'Itens da venda' }));

    // The product is "Vela de baunilha", at R$ 11,27, today.
    expect(items.getByText('Vela Baunilha Clássica')).toBeInTheDocument();
    expect(items.getByText('2 un')).toBeInTheDocument();
    expect(items.getByText('R$ 10,00 a cada 1 un')).toBeInTheDocument();
    expect(items.getByText(`R$${SPACE}20,00`, VERBATIM)).toBeInTheDocument();
    expect(screen.queryByText('Vela de baunilha')).not.toBeInTheDocument();
    expect(screen.queryByText(/11,27/)).not.toBeInTheDocument();
  });

  it('show the frozen fraction of a loose material in its own unit, and the total from the API', async () => {
    await openSale();
    const items = within(screen.getByRole('list', { name: 'Itens da venda' }));

    // The unit is not in the sale's answer: it comes from the material.
    expect(await items.findByText('120 g')).toBeInTheDocument();
    expect(items.getByText('R$ 33,60 a cada 1 kg')).toBeInTheDocument();
    expect(items.getByText(`R$${SPACE}4,03`, VERBATIM)).toBeInTheDocument();
    // 20,00 + 4,03: the API's total, which is the sum of the lines it rounded.
    expect(screen.getByText('Total da venda').nextElementSibling).toHaveTextContent('R$ 24,03');
  });

  it('lead to the product only to navigate, and only for a product', async () => {
    await openSale();
    const items = within(screen.getByRole('list', { name: 'Itens da venda' }));

    const link = items.getByRole('link', { name: /ficha técnica do produto/ });

    expect(link).toHaveAttribute('href', '/fichas-tecnicas/prod-baunilha');
    // The material line has nothing to open.
    expect(items.getAllByRole('link')).toHaveLength(1);
  });

  it('read the unit from the line itself, not from the material as it is today', async () => {
    // The material has been changed to pieces since the sale: the sale was of 120 g.
    server.use(
      ...salesHandlers(),
      ...materialsHandlers({
        materials: [{ ...cera, consumptionUnit: 'UNIT', consumptionUnitSymbol: 'un' }],
      }),
      ...compositeProductsHandlers(),
    );
    renderSales(`/vendas/${vendaMarina.id}`);
    await screen.findByRole('heading', { name: 'Marina Souza', level: 1 });
    const items = within(screen.getByRole('list', { name: 'Itens da venda' }));

    expect(items.getByText('120 g')).toBeInTheDocument();
    expect(items.getByText('R$ 33,60 a cada 1 kg')).toBeInTheDocument();
    expect(items.queryByText('120 un')).not.toBeInTheDocument();
  });

  it('show the quantity at once, with no wait for the materials', async () => {
    server.use(
      http.get(`${API}/materials`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));

        return HttpResponse.json([]);
      }),
      ...salesHandlers(),
      ...compositeProductsHandlers(),
    );
    renderSales(`/vendas/${vendaMarina.id}`);

    // The materials are still on their way: the line already says what and how much.
    expect(await screen.findByText('120 g')).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });
});

describe('the two states of a sale', () => {
  it('are two controls, each marked with its own value', async () => {
    await openSale(vendaJoao);

    expect(group('Pagamento').getByRole('radio', { name: 'Pago' })).toBeChecked();
    expect(group('Pagamento').getByRole('radio', { name: 'Pendente' })).not.toBeChecked();
    expect(group('Produção').getByRole('radio', { name: 'Montado' })).toBeChecked();
    expect(group('Produção').getAllByRole('radio')).toHaveLength(3);
    expect(
      screen.getByText('Pagamento e produção são independentes: mudar um não altera o outro.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/status/i)).not.toBeInTheDocument();
  });

  it('change the payment alone: one request, no question, the production untouched', async () => {
    const user = userEvent.setup();
    const writes = trackWrites();
    const bodies: unknown[] = [];
    await openSale(vendaMarina, [], (write) => bodies.push(write.body));

    await user.click(group('Pagamento').getByRole('radio', { name: 'Pago' }));

    expect(await screen.findByText('Pagamento marcado como Pago.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(bodies).toEqual([{ paymentStatus: 'PAID' }]);
    expect(writes.map((write) => write.path)).toEqual([`/sales/${vendaMarina.id}/payment-status`]);
    await waitFor(() => {
      expect(group('Pagamento').getByRole('radio', { name: 'Pago' })).toBeChecked();
    });
    expect(group('Produção').getByRole('radio', { name: 'Pendente' })).toBeChecked();
  });

  it('change the production alone, and leave the payment where it was', async () => {
    const user = userEvent.setup();
    const writes = trackWrites();
    await openSale(vendaJoao);

    await user.click(group('Produção').getByRole('radio', { name: 'Entregue' }));

    expect(await screen.findByText('Produção marcada como Entregue.')).toBeInTheDocument();
    expect(writes.map((write) => write.path)).toEqual([`/sales/${vendaJoao.id}/production-status`]);
    expect(group('Pagamento').getByRole('radio', { name: 'Pago' })).toBeChecked();
  });

  it('asks before delivering a pending sale, because that debits the stock too, and leaves the payment alone', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    await openSale(vendaMarina, [], (write) => bodies.push(write.body));

    await user.click(group('Produção').getByRole('radio', { name: 'Entregue' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Marcar esta venda como entregue?')).toBeInTheDocument();
    expect(within(dialog).getByText(/O estoque será debitado agora/)).toBeInTheDocument();
    expect(bodies).toEqual([]);

    await user.click(within(dialog).getByRole('button', { name: 'Marcar como entregue' }));

    expect(await screen.findByText('Produção marcada como Entregue.')).toBeInTheDocument();
    expect(bodies).toEqual([{ productionStatus: 'DELIVERED' }]);
    expect(group('Pagamento').getByRole('radio', { name: 'Pendente' })).toBeChecked();
  });

  it('asks nothing when the move does not touch the stock: assembled to delivered', async () => {
    const user = userEvent.setup();
    await openSale(vendaJoao);

    await user.click(group('Produção').getByRole('radio', { name: 'Entregue' }));

    expect(await screen.findByText('Produção marcada como Entregue.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('asks before taking a delivered sale back to pending, and says the stock returns', async () => {
    const user = userEvent.setup();
    await openSale(vendaAna);

    await user.click(group('Produção').getByRole('radio', { name: 'Pendente' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Voltar a produção para Pendente?')).toBeInTheDocument();
    expect(within(dialog).getByText(/O estoque debitado será devolvido/)).toBeInTheDocument();
    expect(within(dialog).getByText(/volta a poder ser editada/)).toBeInTheDocument();
  });
});

describe('assembling a sale', () => {
  it('asks first and says the stock will be debited, and does nothing if the answer is no', async () => {
    const user = userEvent.setup();
    const writes = trackWrites();
    await openSale();

    await user.click(group('Produção').getByRole('radio', { name: 'Montado' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/O estoque será debitado agora/)).toBeInTheDocument();
    expect(writes).toEqual([]);

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(writes).toEqual([]);
    expect(group('Produção').getByRole('radio', { name: 'Pendente' })).toBeChecked();
  });

  it('sends the change once confirmed, and reads sales, materials, products and shortages again', async () => {
    const user = userEvent.setup();
    const writes = trackWrites();
    const { queryClient, materialRequests } = await openSale();
    // Screens that are not open, but whose numbers the assembly changes.
    queryClient.setQueryData(
      [QUERY_ROOTS.compositeProducts, 'list', { includeDiscontinued: false }],
      [],
    );
    queryClient.setQueryData([QUERY_ROOTS.shortages, 'list'], []);
    // The two lists nobody has open are only marked: the one the page itself reads
    // (the photos) is read again at once, so it is not the one to look at.
    const stale = (root: string) =>
      queryClient
        .getQueryCache()
        .findAll({ queryKey: [root] })
        .filter((query) => !query.isActive())
        .every((query) => query.state.isInvalidated);
    expect(materialRequests).toHaveLength(1);

    await user.click(group('Produção').getByRole('radio', { name: 'Montado' }));
    await user.click(await screen.findByRole('button', { name: 'Marcar como montada' }));

    expect(await screen.findByText('Produção marcada como Montado.')).toBeInTheDocument();
    expect(writes.map((write) => write.path)).toEqual([
      `/sales/${vendaMarina.id}/production-status`,
    ]);
    // The materials on screen are read again: their stock just changed.
    await waitFor(() => expect(materialRequests).toHaveLength(2));
    expect(stale(QUERY_ROOTS.compositeProducts)).toBe(true);
    expect(stale(QUERY_ROOTS.shortages)).toBe(true);
    await waitFor(() => {
      expect(group('Produção').getByRole('radio', { name: 'Montado' })).toBeChecked();
    });
  });

  it('does not touch materials, products or shortages when only the payment changes', async () => {
    const user = userEvent.setup();
    const { queryClient, materialRequests } = await openSale();
    queryClient.setQueryData(
      [QUERY_ROOTS.compositeProducts, 'list', { includeDiscontinued: false }],
      [],
    );
    queryClient.setQueryData([QUERY_ROOTS.shortages, 'list'], []);

    await user.click(group('Pagamento').getByRole('radio', { name: 'Pago' }));
    await screen.findByText('Pagamento marcado como Pago.');

    expect(materialRequests).toHaveLength(1);
    for (const root of [QUERY_ROOTS.compositeProducts, QUERY_ROOTS.shortages]) {
      expect(
        queryClient
          .getQueryCache()
          .findAll({ queryKey: [root] })
          .some((query) => query.state.isInvalidated),
      ).toBe(false);
    }
  });

  it('asks first when it goes back to pending, and says the stock will be returned', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    await openSale(vendaJoao, [], (write) => bodies.push(write.body));

    await user.click(group('Produção').getByRole('radio', { name: 'Pendente' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/O estoque debitado será devolvido/)).toBeInTheDocument();
    expect(bodies).toEqual([]);

    await user.click(within(dialog).getByRole('button', { name: 'Voltar para Pendente' }));

    expect(await screen.findByText('Produção marcada como Pendente.')).toBeInTheDocument();
    expect(bodies).toEqual([{ productionStatus: 'PENDING' }]);
    // Going back is about production only: the sale is still paid.
    expect(group('Pagamento').getByRole('radio', { name: 'Pago' })).toBeChecked();
  });

  it('says, before it happens, that a missing material is debited only as far as it goes', async () => {
    const user = userEvent.setup();
    await openSale();

    await user.click(group('Produção').getByRole('radio', { name: 'Montado' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/debita só o que existe/)).toBeInTheDocument();
    expect(within(dialog).getByText(/marca a venda mesmo assim/)).toBeInTheDocument();
  });

  it('shows the support code when the change fails for a reason of ours', async () => {
    const user = userEvent.setup();
    await openSale(vendaMarina, [
      http.patch(`${API}/sales/:id/production-status`, () =>
        HttpResponse.json(
          apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'err-assemble' }),
          { status: 500 },
        ),
      ),
    ]);

    await user.click(group('Produção').getByRole('radio', { name: 'Montado' }));
    await user.click(await screen.findByRole('button', { name: 'Marcar como montada' }));

    expect(await screen.findByText(/err-assemble/)).toBeInTheDocument();
    expect(screen.queryByText('INTERNAL_ERROR')).not.toBeInTheDocument();
  });
});

describe('changing a sale', () => {
  it('sends only the fields that changed when the customer is edited', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    await openSale(vendaMarina, [
      http.patch(`${API}/sales/:id`, async ({ request }) => {
        bodies.push(await request.json());

        return HttpResponse.json({ ...vendaMarina, customerName: 'Marina S. Lima' });
      }),
    ]);

    await user.click(screen.getByRole('button', { name: 'Editar dados' }));
    const name = await screen.findByLabelText('Cliente');
    await user.clear(name);
    await user.type(name, 'Marina S. Lima');
    await user.click(screen.getByRole('button', { name: 'Salvar dados' }));

    expect(await screen.findByText('Dados da venda atualizados.')).toBeInTheDocument();
    expect(bodies).toEqual([{ customerName: 'Marina S. Lima' }]);
  });

  it('explains a sale that can no longer be changed, with a message of its own', async () => {
    const user = userEvent.setup();
    await openSale(vendaMarina, [
      http.patch(`${API}/sales/:id`, () =>
        HttpResponse.json(apiErrorBody(422, 'SALE_NOT_EDITABLE'), { status: 422 }),
      ),
    ]);

    await user.click(screen.getByRole('button', { name: 'Editar dados' }));
    const name = await screen.findByLabelText('Cliente');
    await user.clear(name);
    await user.type(name, 'Outro nome');
    await user.click(screen.getByRole('button', { name: 'Salvar dados' }));

    expect(
      await screen.findByText('Esta venda não pode mais ser alterada no estado em que está.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('SALE_NOT_EDITABLE')).not.toBeInTheDocument();
  });

  it('offers no editing once the sale has been assembled, and says why', async () => {
    await openSale(vendaJoao);

    expect(screen.getByRole('button', { name: 'Editar dados' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Alterar a quantidade/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remover .* da venda/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Esta venda já foi montada ou entregue/)).toBeInTheDocument();
  });

  it('changes the quantity of a line, and shows the total the API recalculated', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    // 3 x R$ 10,00 = R$ 30,00, plus the R$ 4,03 of cera: the API's own arithmetic.
    const changed = saleDto({
      items: [snapshotVela({ quantity: 3, lineTotal: dec('30.00') }), ceraAvulsa()],
      totalAmount: dec('34.03'),
    });
    const api = mutableSale(vendaMarina);
    await openSale(vendaMarina, [
      http.patch(`${API}/sales/:id/items/:itemId`, async ({ request }) => {
        bodies.push(await request.json());

        return api.change(changed);
      }),
      ...api.handlers,
    ]);

    await user.click(
      screen.getByRole('button', { name: 'Alterar a quantidade de Vela Baunilha Clássica' }),
    );
    const field = await screen.findByLabelText('Nova quantidade');
    expect(field).toHaveValue('2');
    await user.clear(field);
    await user.type(field, '3');
    expect(screen.getByText('3 un')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salvar quantidade' }));

    expect(
      await screen.findByText('Quantidade de Vela Baunilha Clássica alterada.'),
    ).toBeInTheDocument();
    expect(bodies).toEqual([{ quantity: 3 }]);
    await waitFor(() => {
      expect(screen.getByText('Total da venda').nextElementSibling).toHaveTextContent('R$ 34,03');
    });
    expect(screen.getByText(`R$${SPACE}30,00`, VERBATIM)).toBeInTheDocument();
  });

  it('removes a line after asking, and shows the total the API recalculated', async () => {
    const user = userEvent.setup();
    const writes = trackWrites();
    const without = saleDto({ items: [snapshotVela()], totalAmount: dec('20.00') });
    const api = mutableSale(vendaMarina);
    await openSale(vendaMarina, [
      http.delete(`${API}/sales/:id/items/:itemId`, () => api.change(without)),
      ...api.handlers,
    ]);

    await user.click(screen.getByRole('button', { name: 'Remover Cera de soja da venda' }));
    expect(writes).toEqual([]);
    await user.click(await screen.findByRole('button', { name: 'Remover item' }));

    expect(await screen.findByText('Cera de soja saiu da venda.')).toBeInTheDocument();
    expect(writes.map((write) => write.method)).toEqual(['DELETE']);
    await waitFor(() => {
      expect(screen.queryByText('Cera de soja')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Total da venda').nextElementSibling).toHaveTextContent('R$ 20,00');
  });
});

describe('the states of the screen', () => {
  it('shows a skeleton while the sale loads', () => {
    server.use(...salesHandlers(), ...materialsHandlers());
    renderSales(`/vendas/${vendaMarina.id}`);

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('says a sale was not found in words, with a way back', async () => {
    server.use(...salesHandlers(), ...materialsHandlers());
    renderSales('/vendas/nao-existe');

    expect(await screen.findByText('Não foi possível abrir esta venda')).toBeInTheDocument();
    expect(screen.getByText('Venda não encontrada.')).toBeInTheDocument();
    expect(screen.queryByText('SALE_NOT_FOUND')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voltar para as vendas/ })).toHaveAttribute(
      'href',
      '/vendas',
    );
  });
});

describe('the detail of a sale on a phone', () => {
  it('keeps both controls, the items and the actions of an item within reach', async () => {
    setViewportWidth(PHONE_WIDTH);
    await openSale();

    expect(screen.getByRole('radiogroup', { name: 'Pagamento' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Produção' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Itens da venda' })).getAllByRole('listitem'),
    ).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Editar dados' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remover Cera de soja da venda' }),
    ).toBeInTheDocument();
  });
});
