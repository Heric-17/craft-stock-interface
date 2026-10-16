import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { env } from '@/shared/config/env';
import { NON_BREAKING_SPACE } from '@/shared/format';
import { requireDecimalString as dec } from '@/shared/money';
import {
  compositeProductsHandlers,
  velaAposentada,
  velaBaunilha,
  kitPresente,
} from '@/test/fixtures/composite-products';
import { cera, essencia, materialsHandlers, pavio, velaAntiga } from '@/test/fixtures/materials';
import {
  apiErrorBody,
  ceraAvulsa,
  saleDto,
  salesHandlers,
  snapshotVela,
} from '@/test/fixtures/sales';
import { server } from '@/test/msw/server';
import { renderSales } from '@/test/render-sales';
import { VERBATIM } from '@/test/text';
import { PHONE_WIDTH, setViewportWidth } from '@/test/viewport';

const API = env.VITE_API_URL;
const SPACE = NON_BREAKING_SPACE;

afterEach(() => {
  server.events.removeAllListeners();
});

interface Opened {
  bodies: unknown[];
  productRequests: URL[];
  materialRequests: URL[];
}

/**
 * The registration screen over an API that has an active and a discontinued
 * product, and an active and a discontinued material. A POST answers with
 * `created` when the test brings one, and the detail that opens next reads it
 * back, as the real thing would.
 */
async function openNewSale(
  created?: ReturnType<typeof saleDto>,
  extra: Parameters<typeof server.use> = [],
): Promise<Opened> {
  const opened: Opened = { bodies: [], productRequests: [], materialRequests: [] };

  server.use(
    ...extra,
    ...(created === undefined
      ? []
      : [
          http.post(`${API}/sales`, async ({ request }) => {
            opened.bodies.push(await request.json());

            return HttpResponse.json(created, { status: 201 });
          }),
          http.get(`${API}/sales/${created.id}`, () => HttpResponse.json(created)),
        ]),
    ...salesHandlers(),
    ...compositeProductsHandlers({
      products: [velaBaunilha, kitPresente, velaAposentada],
      onRequest: (url) => opened.productRequests.push(url),
    }),
    ...materialsHandlers({
      materials: [cera, essencia, pavio, velaAntiga],
      onRequest: (url) => url.pathname === '/materials' && opened.materialRequests.push(url),
    }),
  );
  renderSales('/vendas/nova');

  await screen.findByRole('button', { name: 'Adicionar item' });

  return opened;
}

const ITEM_NAMES: Record<string, string> = {
  'P:prod-baunilha': 'Vela de baunilha',
  'P:prod-kit': 'Kit presente',
  'M:mat-cera': 'Cera de soja',
  'M:mat-essencia': 'Essência baunilha',
  'M:mat-pavio': 'Pavio encerado',
};

type User = ReturnType<typeof userEvent.setup>;

/** Opens the panel that picks an item, on the tab of the kind asked for, and returns its cards. */
async function openPicker(user: User, kind: 'P' | 'M') {
  await user.click(screen.getByRole('button', { name: 'Adicionar item' }));
  const tabs = await screen.findByRole('radiogroup', { name: 'Tipo de item' });

  await user.click(
    within(tabs).getByRole('radio', { name: kind === 'P' ? /^Produtos/ : /^Insumos avulsos/ }),
  );

  return within(await screen.findByRole('list', { name: 'Itens disponíveis' }));
}

async function pick(user: User, value: string) {
  const cards = await openPicker(user, value.startsWith('P:') ? 'P' : 'M');

  await user.click(cards.getByRole('button', { name: ITEM_NAMES[value] ?? '' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}

async function fillCustomer(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Cliente'), 'Marina Souza');
  await user.type(screen.getByLabelText('Forma de pagamento'), 'Pix');
}

describe('the items that can be sold', () => {
  it('offers active products and active materials only, asked of the API as such', async () => {
    const user = userEvent.setup();
    const { productRequests, materialRequests } = await openNewSale();

    const products = await openPicker(user, 'P');
    // The two kinds are tabs of one panel, each with how many there are.
    const tabs = within(screen.getByRole('radiogroup', { name: 'Tipo de item' }));
    expect(tabs.getByRole('radio', { name: 'Produtos (2)' })).toBeInTheDocument();
    expect(tabs.getByRole('radio', { name: 'Insumos avulsos (3)' })).toBeInTheDocument();
    expect(products.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Kit presente',
      'Vela de baunilha',
    ]);

    await user.click(tabs.getByRole('radio', { name: /^Insumos avulsos/ }));
    const materials = within(screen.getByRole('list', { name: 'Itens disponíveis' }));
    expect(materials.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Cera de soja',
      'Essência baunilha',
      'Pavio encerado',
    ]);
    expect(screen.queryByRole('button', { name: /Vela aposentada/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Fragrância antiga/ })).not.toBeInTheDocument();
    expect(productRequests.at(-1)?.searchParams.get('includeDiscontinued')).toBe('false');
    expect(materialRequests.at(-1)?.searchParams.get('includeDiscontinued')).toBe('false');
  });

  it('shows the photo, the price or cost and the stock of each thing, from the API', async () => {
    const user = userEvent.setup();
    await openNewSale();

    const products = await openPicker(user, 'P');
    const vela = within(
      products.getByRole('button', { name: 'Vela de baunilha' }).closest('article')!,
    );
    const kit = within(products.getByRole('button', { name: 'Kit presente' }).closest('article')!);

    expect(vela.getByRole('img', { name: 'Vela de baunilha (sem foto)' })).toBeInTheDocument();
    expect(vela.getByText(`R$${SPACE}11,27`, VERBATIM)).toBeInTheDocument();
    expect(vela.getByText('3 unidades')).toBeInTheDocument();
    // The one that cannot be made says so, and is still on the list: a sale can wait for stock.
    expect(kit.getByText('Não dá para produzir')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /^Insumos avulsos/ }));
    const cera = within(screen.getByRole('button', { name: 'Cera de soja' }).closest('article')!);
    expect(cera.getByText(`R$${SPACE}28,00/kg`, VERBATIM)).toBeInTheDocument();
    expect(cera.getByText(`680${SPACE}g`, VERBATIM)).toBeInTheDocument();
  });

  it('searches inside the open tab, by name', async () => {
    const user = userEvent.setup();
    await openNewSale();
    await openPicker(user, 'M');

    await user.type(screen.getByRole('searchbox', { name: 'Buscar item' }), 'essencia');

    expect(screen.getAllByRole('button', { name: /Essência baunilha/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Cera de soja' })).not.toBeInTheDocument();
    // A product is not in this tab, whatever the search says.
    await user.clear(screen.getByRole('searchbox', { name: 'Buscar item' }));
    await user.type(screen.getByRole('searchbox', { name: 'Buscar item' }), 'kit');
    expect(await screen.findByText('Nenhum item encontrado')).toBeInTheDocument();
  });

  it('takes an item out of the picker once it is on the sale', async () => {
    const user = userEvent.setup();
    await openNewSale();

    await pick(user, 'P:prod-baunilha');
    const products = await openPicker(user, 'P');

    expect(products.queryByRole('button', { name: 'Vela de baunilha' })).not.toBeInTheDocument();
    expect(products.getByRole('button', { name: 'Kit presente' })).toBeInTheDocument();
  });
});

describe('the margin of a loose material', () => {
  it('starts empty, never zero, and only a loose material has one', async () => {
    const user = userEvent.setup();
    await openNewSale();

    await pick(user, 'M:mat-cera');
    expect(screen.getByLabelText('Margem sobre Cera de soja')).toHaveValue('');
    expect(screen.getByLabelText('Quantidade de Cera de soja')).toHaveValue('');

    await pick(user, 'P:prod-baunilha');
    // A product carries the margin of its bill of materials: nothing to type.
    expect(screen.queryByLabelText('Margem sobre Vela de baunilha')).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/^Margem sobre/)).toHaveLength(1);
  });

  it('blocks the sale while it is empty, says zero is a choice and sends nothing', async () => {
    const user = userEvent.setup();
    const writes: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method !== 'GET') {
        writes.push(request.method);
      }
    });
    await openNewSale();
    await fillCustomer(user);
    await pick(user, 'M:mat-cera');
    await user.type(screen.getByLabelText('Quantidade de Cera de soja'), '120');

    await user.click(screen.getByRole('button', { name: 'Registrar venda' }));

    expect(
      await screen.findByText('Informe a margem. Digite 0 para vender a preço de custo.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Margem sobre Cera de soja')).toBeInvalid();
    expect(writes).toEqual([]);
    // No margin, no price: the preview does not make one up.
    expect(screen.getByText('Total (prévia)').nextElementSibling).toHaveTextContent('—');
  });

  it('accepts a zero typed on purpose, and sends it as 0 basis points', async () => {
    const user = userEvent.setup();
    // 28,00 x 120 / 1000 at cost: R$ 3,36 — not the R$ 3,60 of rounding the gram first.
    const created = saleDto({
      id: 'dddd4444-0000-4000-8000-000000000004',
      items: [
        ceraAvulsa({
          priceBasisAmount: dec('28.00'),
          unitPrice: dec('0.0280'),
          lineTotal: dec('3.36'),
        }),
      ],
      totalAmount: dec('3.36'),
    });
    const { bodies } = await openNewSale(created);
    await fillCustomer(user);
    await pick(user, 'M:mat-cera');
    await user.type(screen.getByLabelText('Quantidade de Cera de soja'), '120');
    await user.type(screen.getByLabelText('Margem sobre Cera de soja'), '0');

    expect(screen.getByText('Total (prévia)').nextElementSibling).toHaveTextContent('R$ 3,36');

    await user.click(screen.getByRole('button', { name: 'Registrar venda' }));

    expect(await screen.findByText('Venda registrada.')).toBeInTheDocument();
    expect(bodies).toEqual([
      {
        customerName: 'Marina Souza',
        paymentMethod: 'Pix',
        items: [{ materialId: 'mat-cera', quantity: 120, marginBasisPoints: 0 }],
      },
    ]);
  });

  it('shows the API refusal on the margin field when it slips past the form', async () => {
    const user = userEvent.setup();
    await openNewSale(undefined, [
      http.post(`${API}/sales`, () =>
        HttpResponse.json(apiErrorBody(422, 'MISSING_LOOSE_MATERIAL_MARGIN'), { status: 422 }),
      ),
    ]);
    await fillCustomer(user);
    await pick(user, 'M:mat-cera');
    await user.type(screen.getByLabelText('Quantidade de Cera de soja'), '120');
    await user.type(screen.getByLabelText('Margem sobre Cera de soja'), '0');

    await user.click(screen.getByRole('button', { name: 'Registrar venda' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Margem sobre Cera de soja')).toBeInvalid();
    });
    expect(
      screen.getAllByText(
        'Informe a margem para vender este insumo avulso. Zero vende a preço de custo.',
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('MISSING_LOOSE_MATERIAL_MARGIN')).not.toBeInTheDocument();
  });
});

describe('the preview and the saved sale', () => {
  it('agree to the cent: the preview is replaced by the total the API calculated', async () => {
    const user = userEvent.setup();
    // 2 x R$ 11,27 = 22,54; cera at 20%: 33,60 x 120 / 1000 = 4,03. Total 26,57.
    const created = saleDto({
      id: 'eeee5555-0000-4000-8000-000000000005',
      items: [
        snapshotVela({
          quantity: 2,
          itemNameSnapshot: 'Vela de baunilha',
          priceBasisAmount: dec('11.27'),
          unitPrice: dec('11.2700'),
          lineTotal: dec('22.54'),
        }),
        ceraAvulsa(),
      ],
      totalAmount: dec('26.57'),
    });
    const { bodies } = await openNewSale(created);
    await fillCustomer(user);
    await pick(user, 'P:prod-baunilha');
    await user.type(screen.getByLabelText('Quantidade de Vela de baunilha'), '2');
    await pick(user, 'M:mat-cera');
    await user.type(screen.getByLabelText('Quantidade de Cera de soja'), '120');
    await user.type(screen.getByLabelText('Margem sobre Cera de soja'), '20');

    const lines = within(screen.getByRole('list', { name: 'Itens da venda' }));
    expect(lines.getByText(`R$${SPACE}22,54`, VERBATIM)).toBeInTheDocument();
    expect(lines.getByText(`R$${SPACE}4,03`, VERBATIM)).toBeInTheDocument();
    const preview = screen.getByText('Total (prévia)').nextElementSibling;
    expect(preview).toHaveTextContent('R$ 26,57');
    expect(screen.getAllByText(/prévia/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Registrar venda' }));

    // The saved sale opens, with the API's total and no word "prévia" left.
    expect(
      await screen.findByRole('heading', { name: 'Marina Souza', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Total da venda').nextElementSibling).toHaveTextContent('R$ 26,57');
    expect(screen.queryByText(/prévia/i)).not.toBeInTheDocument();
    // A product line carries no margin to the API; a loose material does.
    expect(bodies).toEqual([
      {
        customerName: 'Marina Souza',
        paymentMethod: 'Pix',
        items: [
          { compositeProductId: 'prod-baunilha', quantity: 2 },
          { materialId: 'mat-cera', quantity: 120, marginBasisPoints: 2000 },
        ],
      },
    ]);
  });

  it('reads a quantity typed in the larger unit and says what it understood', async () => {
    const user = userEvent.setup();
    await openNewSale();
    await pick(user, 'M:mat-cera');

    await user.type(screen.getByLabelText('Quantidade de Cera de soja'), '1,5');
    await user.click(screen.getByRole('button', { name: 'kg' }));

    expect(screen.getByText('1,5 kg')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Margem sobre Cera de soja'), '0');
    // 28,00 x 1500 / 1000
    expect(screen.getByText('Total (prévia)').nextElementSibling).toHaveTextContent('R$ 42,00');
  });
});

describe('the rest of the form', () => {
  it('says everything that is missing at once', async () => {
    const user = userEvent.setup();
    await openNewSale();

    await user.click(screen.getByRole('button', { name: 'Registrar venda' }));

    expect(await screen.findByText('Informe o nome do cliente.')).toBeInTheDocument();
    expect(screen.getByText('Informe a forma de pagamento.')).toBeInTheDocument();
    expect(screen.getByText('Adicione pelo menos um item à venda.')).toBeInTheDocument();
  });

  it('explains a product that was discontinued meanwhile, in words', async () => {
    const user = userEvent.setup();
    await openNewSale(undefined, [
      http.post(`${API}/sales`, () =>
        HttpResponse.json(apiErrorBody(422, 'DISCONTINUED_COMPOSITE_PRODUCT_REFERENCE'), {
          status: 422,
        }),
      ),
    ]);
    await fillCustomer(user);
    await pick(user, 'P:prod-baunilha');
    await user.type(screen.getByLabelText('Quantidade de Vela de baunilha'), '1');

    await user.click(screen.getByRole('button', { name: 'Registrar venda' }));

    expect(
      await screen.findByText(
        'Este produto está descontinuado e não pode entrar em uma venda nova.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/DISCONTINUED/)).not.toBeInTheDocument();
  });

  it('shows the support code when the products cannot be loaded', async () => {
    server.use(
      http.get(`${API}/composite-products`, () =>
        HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'err-prod' }), {
          status: 500,
        }),
      ),
      ...materialsHandlers(),
      ...salesHandlers(),
    );
    renderSales('/vendas/nova');

    expect(await screen.findByText('Não foi possível carregar os produtos')).toBeInTheDocument();
    expect(screen.getByText('err-prod')).toBeInTheDocument();
  });

  it('shows a skeleton while the products and materials load', () => {
    server.use(...compositeProductsHandlers(), ...materialsHandlers(), ...salesHandlers());
    renderSales('/vendas/nova');

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });
});

describe('registering a sale on a phone', () => {
  it('keeps the whole task within reach: customer, items, margin, total and the action', async () => {
    setViewportWidth(PHONE_WIDTH);
    const user = userEvent.setup();
    await openNewSale();

    await pick(user, 'M:mat-cera');

    expect(screen.getByLabelText('Cliente')).toBeInTheDocument();
    expect(screen.getByLabelText('Forma de pagamento')).toBeInTheDocument();
    expect(screen.getByLabelText('Quantidade de Cera de soja')).toHaveAttribute(
      'inputmode',
      'decimal',
    );
    expect(screen.getByLabelText('Margem sobre Cera de soja')).toHaveAttribute(
      'inputmode',
      'decimal',
    );
    expect(screen.getByText('Total (prévia)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar venda' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });
});

describe('leaving the registration with unsaved changes', () => {
  it('leaves at once when nothing was typed', async () => {
    const user = userEvent.setup();
    server.use(...compositeProductsHandlers(), ...materialsHandlers(), ...salesHandlers());
    const { router } = renderSales('/vendas/nova');
    await screen.findByRole('button', { name: 'Adicionar item' });

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/vendas'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('asks first once something was typed, and keeps the form if the answer is to continue', async () => {
    const user = userEvent.setup();
    server.use(...compositeProductsHandlers(), ...materialsHandlers(), ...salesHandlers());
    const { router } = renderSales('/vendas/nova');
    await screen.findByRole('button', { name: 'Adicionar item' });
    await user.type(screen.getByLabelText('Cliente'), 'Marina');

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText(/o que você preencheu da venda será perdido/),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Continuar editando' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe('/vendas/nova');
    expect(screen.getByLabelText('Cliente')).toHaveValue('Marina');

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Sair sem salvar',
      }),
    );

    await waitFor(() => expect(router.state.location.pathname).toBe('/vendas'));
  });
});
