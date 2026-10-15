import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { env } from '@/shared/config/env';
import { NON_BREAKING_SPACE } from '@/shared/format';
import { requireDecimalString } from '@/shared/money';
import {
  apiErrorBody,
  compositeProductDto,
  compositeProductsHandlers,
  keepProduct,
  kitPresente,
  velaBaunilha,
  velaComInsumoAntigo,
} from '@/test/fixtures/composite-products';
import { cera, essencia, materialsHandlers, pavio, velaAntiga } from '@/test/fixtures/materials';
import { server } from '@/test/msw/server';
import { renderCompositeProducts } from '@/test/render-composite-products';
import { VERBATIM } from '@/test/text';
import { PHONE_WIDTH, setViewportWidth } from '@/test/viewport';

const API = env.VITE_API_URL;
const SPACE = NON_BREAKING_SPACE;
const dec = requireDecimalString;

type User = ReturnType<typeof userEvent.setup>;

/**
 * The reads every editor test needs: the products and every material,
 * discontinued one included.
 *
 * The products are the API's state, and a mutation handler changes them with
 * `keepProduct`: what a `PATCH` answers is also what the next `GET` answers, which is
 * how the real thing behaves and what makes the refetch after saving honest.
 */
function serve(products = [velaBaunilha, kitPresente, velaComInsumoAntigo]) {
  const state = [...products];

  server.use(
    ...compositeProductsHandlers({ products: state }),
    ...materialsHandlers({ materials: [cera, essencia, pavio, velaAntiga] }),
  );

  return state;
}

/** Records the JSON body of each request a route receives. */
function recorder() {
  const bodies: unknown[] = [];

  return {
    bodies,
    async record(request: Request) {
      bodies.push(await request.json());
    },
  };
}

function resultPanel() {
  return within(screen.getByRole('region', { name: 'Resultado da ficha técnica' }));
}

async function openProduct(id: string, name: string) {
  const view = renderCompositeProducts(`/fichas-tecnicas/${id}`);
  await screen.findByRole('heading', { name, level: 1 });

  return view;
}

async function openNewProduct() {
  const view = renderCompositeProducts('/fichas-tecnicas/nova');
  await screen.findByRole('heading', { name: 'Nova ficha técnica', level: 1 });

  return view;
}

async function addMaterial(user: User, materialId: string) {
  await user.selectOptions(screen.getByLabelText('Adicionar insumo'), materialId);
}

describe('the result panel of a saved product', () => {
  it('puts the bottleneck first: how much there is, and how much each unit takes', async () => {
    serve();
    await openProduct('prod-baunilha', 'Vela de baunilha');
    const panel = resultPanel();

    expect(panel.getByText('Dá para produzir')).toBeInTheDocument();
    expect(panel.getByText('3 unidades')).toBeInTheDocument();
    expect(panel.getByText('Insumo gargalo')).toBeInTheDocument();
    expect(panel.getByText('Essência baunilha')).toBeInTheDocument();
    expect(panel.getByText('Em estoque')).toBeInTheDocument();
    expect(panel.getByText(`18${SPACE}ml`, VERBATIM)).toBeInTheDocument();
    expect(panel.getByText('Cada unidade consome')).toBeInTheDocument();
    expect(panel.getByText(`6${SPACE}ml`, VERBATIM)).toBeInTheDocument();
  });

  it('shows the figures the API calculated, labelled as saved', async () => {
    serve();
    await openProduct('prod-baunilha', 'Vela de baunilha');
    const panel = resultPanel();

    expect(panel.getByText('Salvo')).toBeInTheDocument();
    expect(panel.queryByText('Prévia')).not.toBeInTheDocument();
    expect(panel.getByText(`R$${SPACE}5,85`, VERBATIM)).toBeInTheDocument();
    expect(panel.getByText(`R$${SPACE}8,35`, VERBATIM)).toBeInTheDocument();
    // The suggested price and the practiced one are the same figure here.
    expect(panel.getAllByText(`R$${SPACE}11,27`, VERBATIM)).toHaveLength(2);
    expect(panel.getByText('igual ao sugerido')).toBeInTheDocument();
  });

  it('highlights a capacity of zero and names the material that causes it', async () => {
    serve();
    await openProduct('prod-kit', 'Kit presente');
    const panel = resultPanel();

    expect(panel.getByText('0 unidades')).toBeInTheDocument();
    expect(panel.getByText('Não dá para produzir com o estoque atual.')).toBeInTheDocument();
    expect(panel.getByText('Cera de soja')).toBeInTheDocument();
    expect(panel.getByText(`680${SPACE}g`, VERBATIM)).toBeInTheDocument();
    expect(panel.getByText(`700${SPACE}g`, VERBATIM)).toBeInTheDocument();
  });

  it('shows the manual price as the practiced one, beside the suggestion', async () => {
    serve();
    await openProduct('prod-kit', 'Kit presente');
    const panel = resultPanel();

    expect(panel.getByText(`R$${SPACE}32,80`, VERBATIM)).toBeInTheDocument();
    expect(panel.getByText(`R$${SPACE}60,00`, VERBATIM)).toBeInTheDocument();
    expect(panel.getByText('preço manual')).toBeInTheDocument();
  });

  it('fills the form with what the API holds, the margin as a percentage', async () => {
    serve();
    await openProduct('prod-kit', 'Kit presente');

    expect(screen.getByLabelText('Nome do produto')).toHaveValue('Kit presente');
    expect(screen.getByLabelText('Custo fixo por unidade')).toHaveValue('5,00');
    expect(screen.getByLabelText('Margem de lucro')).toHaveValue('33,33');
    expect(screen.getByLabelText('Preço manual (opcional)')).toHaveValue('60,00');
    expect(screen.getByLabelText('Quantidade de Cera de soja por unidade')).toHaveValue('700');
    expect(screen.queryByDisplayValue('3333')).not.toBeInTheDocument();
  });

  it('says that a product that was not found was not found, without the code', async () => {
    serve();
    renderCompositeProducts('/fichas-tecnicas/nao-existe');

    expect(
      await screen.findByText('Não foi possível abrir esta ficha técnica'),
    ).toBeInTheDocument();
    expect(screen.getByText('Produto não encontrado.')).toBeInTheDocument();
    expect(screen.queryByText('COMPOSITE_PRODUCT_NOT_FOUND')).not.toBeInTheDocument();
  });
});

describe('the bill of materials', () => {
  it('offers active materials only, and not the ones already on the bill', async () => {
    const user = userEvent.setup();
    serve();
    await openNewProduct();

    const picker = screen.getByLabelText('Adicionar insumo');
    const options = () =>
      within(picker)
        .getAllByRole('option')
        .map((option) => option.textContent);

    expect(options()).toEqual([
      'Escolha um insumo',
      'Cera de soja (g)',
      'Essência baunilha (ml)',
      'Pavio encerado (un)',
    ]);
    expect(options()).not.toContain('Fragrância antiga (g)');

    await addMaterial(user, 'mat-cera');

    expect(options()).not.toContain('Cera de soja (g)');
    expect(screen.getByRole('list', { name: 'Itens da ficha' })).toBeInTheDocument();
    expect(screen.getByLabelText('Quantidade de Cera de soja por unidade')).toHaveValue('');
  });

  it('keeps a line whose material was discontinued, sealed and intact, out of the picker', async () => {
    serve();
    await openProduct('prod-antigo', 'Vela com fragrância antiga');

    const items = within(screen.getByRole('list', { name: 'Itens da ficha' }));

    expect(items.getByText('Fragrância antiga')).toBeInTheDocument();
    expect(items.getByText('Descontinuado')).toBeInTheDocument();
    expect(items.getByLabelText('Quantidade de Fragrância antiga por unidade')).toHaveValue('100');
    expect(items.getByText(`R$${SPACE}2,80`, VERBATIM)).toBeInTheDocument();
    expect(
      screen.getByText(/Um insumo desta ficha foi descontinuado\. Ele continua na ficha/),
    ).toBeInTheDocument();

    const options = within(screen.getByLabelText('Adicionar insumo'))
      .getAllByRole('option')
      .map((option) => option.textContent);

    expect(options).not.toContain('Fragrância antiga (g)');
    expect(options).toContain('Cera de soja (g)');
  });

  it('removes a line, and the material comes back to the picker', async () => {
    const user = userEvent.setup();
    serve();
    await openProduct('prod-baunilha', 'Vela de baunilha');

    await user.click(screen.getByRole('button', { name: 'Remover Pavio encerado da ficha' }));

    expect(
      screen.queryByLabelText('Quantidade de Pavio encerado por unidade'),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByLabelText('Adicionar insumo')).getByRole('option', {
        name: 'Pavio encerado (un)',
      }),
    ).toBeInTheDocument();
  });

  it('types the quantity in the larger unit and shows what it understood before saving', async () => {
    const user = userEvent.setup();
    serve();
    await openNewProduct();
    await addMaterial(user, 'mat-cera');

    await user.type(screen.getByLabelText('Quantidade de Cera de soja por unidade'), '0,12');
    await user.click(screen.getByRole('button', { name: 'kg' }));

    expect(screen.getByText(`120${SPACE}g`, VERBATIM)).toBeInTheDocument();
  });

  it('gives a unit with no larger one the plain field', async () => {
    const user = userEvent.setup();
    serve();
    await openNewProduct();
    await addMaterial(user, 'mat-pavio');

    expect(screen.getByLabelText('Quantidade de Pavio encerado por unidade')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'kg' })).not.toBeInTheDocument();
  });
});

describe('the preview while editing', () => {
  async function fillNewProduct(user: User) {
    await addMaterial(user, 'mat-cera');
    await user.type(screen.getByLabelText('Quantidade de Cera de soja por unidade'), '120');
    await user.type(screen.getByLabelText('Custo fixo por unidade'), '2,50');
    await user.type(screen.getByLabelText('Margem de lucro'), '35');
  }

  it('starts with dashes, not zeros, and says capacity waits for the first save', async () => {
    serve();
    await openNewProduct();
    const panel = resultPanel();

    expect(panel.getByText('Prévia')).toBeInTheDocument();
    expect(panel.getAllByText('—').length).toBeGreaterThanOrEqual(4);
    // The one figure is the cost of a bill with no lines, which is truly zero.
    expect(panel.getAllByText(/R\$/)).toHaveLength(1);
    expect(panel.getByText(`R$${SPACE}0,00`, VERBATIM)).toBeInTheDocument();
    expect(
      panel.getByText(
        /A capacidade de produção é calculada pelo sistema depois que a ficha é salva/,
      ),
    ).toBeInTheDocument();
  });

  it('prices a new product as the form is filled, labelled as a preview', async () => {
    const user = userEvent.setup();
    serve();
    await openNewProduct();

    await fillNewProduct(user);

    // 28,00 x 120 / 1000 = 3,36; plus 2,50 = 5,86; x 1,35 = 7,911.
    const panel = resultPanel();
    expect(panel.getByText('Prévia')).toBeInTheDocument();
    expect(panel.getByText(`R$${SPACE}3,36`, VERBATIM)).toBeInTheDocument();
    expect(panel.getByText(`R$${SPACE}5,86`, VERBATIM)).toBeInTheDocument();
    expect(panel.getAllByText(`R$${SPACE}7,91`, VERBATIM)).toHaveLength(2);
    expect(panel.queryByText('Salvo')).not.toBeInTheDocument();
  });

  it('puts the cost of each line on the line, as a preview', async () => {
    const user = userEvent.setup();
    serve();
    await openNewProduct();

    await addMaterial(user, 'mat-cera');
    const item = within(screen.getByRole('list', { name: 'Itens da ficha' }));
    expect(item.getByText('Custo da linha (prévia)')).toBeInTheDocument();
    expect(item.getByText('—')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Quantidade de Cera de soja por unidade'), '120');

    expect(item.getByText(`R$${SPACE}3,36`, VERBATIM)).toBeInTheDocument();
  });

  it('is the practiced price that the manual price overrides, and the suggestion stays', async () => {
    const user = userEvent.setup();
    serve();
    await openNewProduct();
    await fillNewProduct(user);

    await user.type(screen.getByLabelText('Preço manual (opcional)'), '12');

    const panel = resultPanel();
    expect(panel.getByText(`R$${SPACE}7,91`, VERBATIM)).toBeInTheDocument();
    expect(panel.getByText(`R$${SPACE}12,00`, VERBATIM)).toBeInTheDocument();
    expect(panel.getByText('preço manual')).toBeInTheDocument();
  });

  it('shows the margin the way it is typed and reads it, with the echo, before saving', async () => {
    const user = userEvent.setup();
    serve();
    await openNewProduct();

    await user.type(screen.getByLabelText('Margem de lucro'), '33,33');

    expect(screen.getByText('33,33%')).toBeInTheDocument();
    expect(screen.queryByText('3333')).not.toBeInTheDocument();
  });

  it('replaces the saved figures with a preview as soon as something that moves a price changes', async () => {
    const user = userEvent.setup();
    serve();
    await openProduct('prod-baunilha', 'Vela de baunilha');
    expect(resultPanel().getByText('Salvo')).toBeInTheDocument();

    const margin = screen.getByLabelText('Margem de lucro');
    await user.clear(margin);
    await user.type(margin, '40');

    // 8,35 x 1,40 = 11,69.
    const panel = resultPanel();
    expect(panel.getByText('Prévia')).toBeInTheDocument();
    expect(panel.queryByText('Salvo')).not.toBeInTheDocument();
    expect(panel.getAllByText(`R$${SPACE}11,69`, VERBATIM)).toHaveLength(2);
  });

  it('keeps the saved figures when only the name changes', async () => {
    const user = userEvent.setup();
    serve();
    await openProduct('prod-baunilha', 'Vela de baunilha');

    await user.type(screen.getByLabelText('Nome do produto'), ' premium');

    expect(resultPanel().getByText('Salvo')).toBeInTheDocument();
  });

  it('says the capacity is still the saved bill’s while the lines are being changed', async () => {
    const user = userEvent.setup();
    serve();
    await openProduct('prod-baunilha', 'Vela de baunilha');
    expect(resultPanel().queryByText(/Vale para a ficha salva/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remover Pavio encerado da ficha' }));

    const panel = resultPanel();
    expect(panel.getByText(/Vale para a ficha salva/)).toBeInTheDocument();
    expect(panel.getByText('3 unidades')).toBeInTheDocument();
  });
});

describe('saving a product', () => {
  it('shows the API’s figures after saving, and says only what changed was sent', async () => {
    const user = userEvent.setup();
    const patched = recorder();
    const state = serve();
    server.use(
      http.patch(`${API}/composite-products/prod-baunilha`, async ({ request }) => {
        await patched.record(request);

        return HttpResponse.json(
          keepProduct(
            state,
            compositeProductDto({
              profitMarginBasisPoints: 4000,
              suggestedPrice: dec('11.69'),
              finalPrice: dec('11.69'),
            }),
          ),
        );
      }),
    );
    await openProduct('prod-baunilha', 'Vela de baunilha');

    const margin = screen.getByLabelText('Margem de lucro');
    await user.clear(margin);
    await user.type(margin, '40');
    expect(resultPanel().getByText('Prévia')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Ficha técnica atualizada.')).toBeInTheDocument();
    // The bill of materials did not change, so it was not sent back.
    expect(patched.bodies).toEqual([{ profitMarginBasisPoints: 4000 }]);
    await waitFor(() => expect(resultPanel().getByText('Salvo')).toBeInTheDocument());
    expect(resultPanel().queryByText('Prévia')).not.toBeInTheDocument();
    expect(resultPanel().getAllByText(`R$${SPACE}11,69`, VERBATIM)).toHaveLength(2);
  });

  it('shows the value the API answered with, not the one the preview had', async () => {
    const user = userEvent.setup();
    const state = serve();
    server.use(
      http.patch(`${API}/composite-products/prod-baunilha`, () =>
        HttpResponse.json(
          keepProduct(
            state,
            compositeProductDto({
              profitMarginBasisPoints: 4000,
              suggestedPrice: dec('11.70'),
              finalPrice: dec('11.70'),
            }),
          ),
        ),
      ),
    );
    await openProduct('prod-baunilha', 'Vela de baunilha');

    const margin = screen.getByLabelText('Margem de lucro');
    await user.clear(margin);
    await user.type(margin, '40');
    expect(resultPanel().getAllByText(`R$${SPACE}11,69`, VERBATIM)).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(resultPanel().getByText('Salvo')).toBeInTheDocument());
    expect(resultPanel().getAllByText(`R$${SPACE}11,70`, VERBATIM)).toHaveLength(2);
    expect(resultPanel().queryByText(`R$${SPACE}11,69`, VERBATIM)).not.toBeInTheDocument();
  });

  it('sends the whole bill when a quantity changed, and only then', async () => {
    const user = userEvent.setup();
    const patched = recorder();
    serve();
    server.use(
      http.patch(`${API}/composite-products/prod-baunilha`, async ({ request }) => {
        await patched.record(request);

        return HttpResponse.json(velaBaunilha);
      }),
    );
    await openProduct('prod-baunilha', 'Vela de baunilha');

    const quantity = screen.getByLabelText('Quantidade de Cera de soja por unidade');
    await user.clear(quantity);
    await user.type(quantity, '150');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(patched.bodies).toHaveLength(1));
    expect(patched.bodies[0]).toEqual({
      billOfMaterials: [
        { materialId: 'mat-cera', quantity: 150 },
        { materialId: 'mat-essencia', quantity: 6 },
        { materialId: 'mat-pavio', quantity: 1 },
      ],
    });
  });

  it('clears a manual price by sending null, and a description the same way', async () => {
    const user = userEvent.setup();
    const patched = recorder();
    serve();
    server.use(
      http.patch(`${API}/composite-products/prod-kit`, async ({ request }) => {
        await patched.record(request);

        return HttpResponse.json(kitPresente);
      }),
    );
    await openProduct('prod-kit', 'Kit presente');

    await user.clear(screen.getByLabelText('Preço manual (opcional)'));
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(patched.bodies).toHaveLength(1));
    expect(patched.bodies[0]).toEqual({ manualPrice: null });
  });

  it('has nothing to save until something changes', async () => {
    serve();
    await openProduct('prod-baunilha', 'Vela de baunilha');

    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled();
  });

  it('registers a product: sends what was typed, the margin in basis points, and opens it', async () => {
    const user = userEvent.setup();
    const posted = recorder();
    const created = compositeProductDto({
      id: 'prod-novo',
      name: 'Vela de coco',
      fixedOperationalCost: dec('2.50'),
      profitMarginBasisPoints: 3333,
      billOfMaterials: [{ ...velaBaunilha.billOfMaterials[0]!, quantity: 120 }],
    });
    serve([velaBaunilha, created]);
    server.use(
      http.post(`${API}/composite-products`, async ({ request }) => {
        await posted.record(request);

        return HttpResponse.json(created, { status: 201 });
      }),
    );
    const { router } = await openNewProduct();

    await user.type(screen.getByLabelText('Nome do produto'), 'Vela de coco');
    await addMaterial(user, 'mat-cera');
    await user.type(screen.getByLabelText('Quantidade de Cera de soja por unidade'), '120');
    await user.type(screen.getByLabelText('Custo fixo por unidade'), '2,50');
    await user.type(screen.getByLabelText('Margem de lucro'), '33,33');
    await user.click(screen.getByRole('button', { name: 'Salvar ficha técnica' }));

    expect(await screen.findByText('Ficha técnica cadastrada.')).toBeInTheDocument();
    expect(posted.bodies).toEqual([
      {
        name: 'Vela de coco',
        fixedOperationalCost: '2.50',
        profitMarginBasisPoints: 3333,
        billOfMaterials: [{ materialId: 'mat-cera', quantity: 120 }],
      },
    ]);
    // The saved product replaces "nova" in the address and the screen shows the API's figures.
    await screen.findByRole('heading', { name: 'Vela de coco', level: 1 });
    expect(router.state.location.pathname).toBe('/fichas-tecnicas/prod-novo');
    expect(resultPanel().getByText('Salvo')).toBeInTheDocument();
  });

  it('sends the quantity typed in kilos as grams', async () => {
    const user = userEvent.setup();
    const posted = recorder();
    serve();
    server.use(
      http.post(`${API}/composite-products`, async ({ request }) => {
        await posted.record(request);

        return HttpResponse.json(velaBaunilha, { status: 201 });
      }),
    );
    await openNewProduct();

    await user.type(screen.getByLabelText('Nome do produto'), 'Vela');
    await addMaterial(user, 'mat-cera');
    await user.type(screen.getByLabelText('Quantidade de Cera de soja por unidade'), '0,12');
    await user.click(screen.getByRole('button', { name: 'kg' }));
    await user.type(screen.getByLabelText('Custo fixo por unidade'), '0');
    await user.type(screen.getByLabelText('Margem de lucro'), '0');
    await user.click(screen.getByRole('button', { name: 'Salvar ficha técnica' }));

    await waitFor(() => expect(posted.bodies).toHaveLength(1));
    expect(posted.bodies[0]).toMatchObject({
      profitMarginBasisPoints: 0,
      billOfMaterials: [{ materialId: 'mat-cera', quantity: 120 }],
    });
  });

  it('asks for every empty required field instead of sending zeros', async () => {
    const user = userEvent.setup();
    let posted = false;
    serve();
    server.use(
      http.post(`${API}/composite-products`, () => {
        posted = true;

        return HttpResponse.json(velaBaunilha, { status: 201 });
      }),
    );
    await openNewProduct();

    await addMaterial(user, 'mat-cera');
    await user.click(screen.getByRole('button', { name: 'Salvar ficha técnica' }));

    expect(await screen.findByText('Informe o nome do produto.')).toBeInTheDocument();
    expect(screen.getByText('Informe o custo fixo. Digite 0 se não houver.')).toBeInTheDocument();
    expect(
      screen.getByText('Informe a margem de lucro. Digite 0 para vender a preço de custo.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Informe quanto de insumo cada unidade consome.')).toBeInTheDocument();
    expect(screen.getByLabelText('Custo fixo por unidade')).toHaveValue('');
    expect(screen.getByLabelText('Margem de lucro')).toHaveValue('');
    expect(posted).toBe(false);
  });

  it('refuses a third decimal place in the margin instead of rounding it', async () => {
    const user = userEvent.setup();
    serve();
    await openNewProduct();

    await user.type(screen.getByLabelText('Nome do produto'), 'Vela');
    await user.type(screen.getByLabelText('Custo fixo por unidade'), '0');
    await user.type(screen.getByLabelText('Margem de lucro'), '33,333');
    await user.click(screen.getByRole('button', { name: 'Salvar ficha técnica' }));

    expect(
      await screen.findByText(/A margem vai de 0 a 999,99, com até 2 casas decimais/),
    ).toBeInTheDocument();
    expect(screen.queryByText('33,33%')).not.toBeInTheDocument();
  });

  it('puts the error of a line the API refused on that line', async () => {
    const user = userEvent.setup();
    serve();
    server.use(
      http.patch(`${API}/composite-products/prod-baunilha`, () =>
        HttpResponse.json(
          apiErrorBody(400, 'VALIDATION_FAILED', [
            { path: 'billOfMaterials.1.quantity', constraints: ['quantity must be positive'] },
          ]),
          { status: 400 },
        ),
      ),
    );
    await openProduct('prod-baunilha', 'Vela de baunilha');

    const quantity = screen.getByLabelText('Quantidade de Essência baunilha por unidade');
    await user.clear(quantity);
    await user.type(quantity, '7');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Confira este campo.')).toBeInTheDocument();
    expect(quantity).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Confira os campos destacados e tente de novo.')).toBeInTheDocument();
  });

  it('explains a refusal to save a bill that still holds a discontinued material', async () => {
    const user = userEvent.setup();
    serve();
    server.use(
      http.patch(`${API}/composite-products/prod-antigo`, () =>
        HttpResponse.json(apiErrorBody(422, 'INACTIVE_MATERIAL_REFERENCE'), { status: 422 }),
      ),
    );
    await openProduct('prod-antigo', 'Vela com fragrância antiga');

    const quantity = screen.getByLabelText('Quantidade de Fragrância antiga por unidade');
    await user.clear(quantity);
    await user.type(quantity, '90');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(
      await screen.findByText(/Remova esse item da ficha ou reative o insumo para salvar/),
    ).toBeInTheDocument();
    expect(screen.queryByText('INACTIVE_MATERIAL_REFERENCE')).not.toBeInTheDocument();
  });

  it('shows the support code of an unexpected failure and keeps what was typed', async () => {
    const user = userEvent.setup();
    serve();
    server.use(
      http.patch(`${API}/composite-products/prod-baunilha`, () =>
        HttpResponse.json(
          apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'err-save-9' }),
          { status: 500 },
        ),
      ),
    );
    await openProduct('prod-baunilha', 'Vela de baunilha');

    await user.type(screen.getByLabelText('Nome do produto'), ' 2');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText(/err-save-9/)).toBeInTheDocument();
    expect(screen.getByLabelText('Nome do produto')).toHaveValue('Vela de baunilha 2');
  });
});

describe('the photo', () => {
  const png = () => new File(['x'], 'foto.png', { type: 'image/png' });

  it('sends the photo as a second call, after the product exists', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    serve();
    server.use(
      http.post(`${API}/composite-products`, () => {
        calls.push('create');

        return HttpResponse.json(velaBaunilha, { status: 201 });
      }),
      http.post(`${API}/composite-products/prod-baunilha/image`, async ({ request }) => {
        calls.push('image');
        expect(((await request.formData()).get('file') as Blob).type).toBe('image/png');

        return HttpResponse.json(velaBaunilha);
      }),
    );
    await openNewProduct();

    await user.type(screen.getByLabelText('Nome do produto'), 'Vela');
    await user.type(screen.getByLabelText('Custo fixo por unidade'), '0');
    await user.type(screen.getByLabelText('Margem de lucro'), '0');
    await user.upload(screen.getByLabelText('Escolher foto'), png());
    expect(screen.getByText('foto.png')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salvar ficha técnica' }));

    expect(await screen.findByText('Ficha técnica cadastrada com foto.')).toBeInTheDocument();
    expect(calls).toEqual(['create', 'image']);
  });

  it('keeps the product when the photo fails, says so, and offers another go', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    serve();
    server.use(
      http.post(`${API}/composite-products`, () =>
        HttpResponse.json(velaBaunilha, { status: 201 }),
      ),
      http.post(`${API}/composite-products/prod-baunilha/image`, () => {
        attempts += 1;

        return attempts === 1
          ? HttpResponse.json(apiErrorBody(503, 'IMAGE_UPLOAD_FAILED'), { status: 503 })
          : HttpResponse.json(velaBaunilha);
      }),
    );
    const { router } = await openNewProduct();

    await user.type(screen.getByLabelText('Nome do produto'), 'Vela');
    await user.type(screen.getByLabelText('Custo fixo por unidade'), '0');
    await user.type(screen.getByLabelText('Margem de lucro'), '0');
    await user.upload(screen.getByLabelText('Escolher foto'), png());
    await user.click(screen.getByRole('button', { name: 'Salvar ficha técnica' }));

    expect(
      await screen.findByText(/foi cadastrada, mas a foto não foi enviada/),
    ).toBeInTheDocument();
    expect(screen.getByText('Vela de baunilha', { selector: 'strong' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/fichas-tecnicas/nova');

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('Foto enviada.')).toBeInTheDocument();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/fichas-tecnicas/prod-baunilha'),
    );
  });

  it('changes the photo of a saved product on the spot', async () => {
    const user = userEvent.setup();
    const state = serve();
    server.use(
      http.post(`${API}/composite-products/prod-baunilha/image`, () =>
        HttpResponse.json(
          keepProduct(state, compositeProductDto({ imageUrl: 'https://img.example/vela.png' })),
        ),
      ),
    );
    await openProduct('prod-baunilha', 'Vela de baunilha');

    await user.upload(screen.getByLabelText('Adicionar foto'), png());

    expect(await screen.findByText('Foto atualizada.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Remover foto' })).toBeInTheDocument();
  });
});

describe('discontinuing, reactivating and deleting', () => {
  it('discontinues after confirming, and says what it means', async () => {
    const user = userEvent.setup();
    const state = serve();
    server.use(
      http.post(`${API}/composite-products/prod-baunilha/discontinue`, () =>
        HttpResponse.json(
          keepProduct(
            state,
            compositeProductDto({ isActive: false, discontinuedAt: '2026-10-13T12:00:00.000Z' }),
          ),
        ),
      ),
    );
    await openProduct('prod-baunilha', 'Vela de baunilha');

    await user.click(screen.getByRole('button', { name: 'Descontinuar' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText(/deixa de aparecer ao montar uma venda nova/),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Descontinuar' }));

    expect(await screen.findByText('Vela de baunilha foi descontinuado.')).toBeInTheDocument();
    expect(await screen.findByText(/Este produto está descontinuado/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Reativar' })).toBeInTheDocument();
  });

  it('reactivates a discontinued product', async () => {
    const user = userEvent.setup();
    const discontinued = compositeProductDto({
      isActive: false,
      discontinuedAt: '2026-09-20T15:00:00.000Z',
    });
    const state = serve([discontinued]);
    server.use(
      http.post(`${API}/composite-products/prod-baunilha/reactivate`, () =>
        HttpResponse.json(keepProduct(state, velaBaunilha)),
      ),
    );
    await openProduct('prod-baunilha', 'Vela de baunilha');
    expect(screen.getByText(/Este produto está descontinuado/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reativar' }));

    expect(await screen.findByText('Vela de baunilha voltou a ficar ativo.')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText(/Este produto está descontinuado/)).not.toBeInTheDocument(),
    );
  });

  it('deletes after confirming and goes back to the list', async () => {
    const user = userEvent.setup();
    serve();
    server.use(
      http.delete(
        `${API}/composite-products/prod-baunilha`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const { router } = await openProduct('prod-baunilha', 'Vela de baunilha');

    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }),
    );

    expect(await screen.findByText('Vela de baunilha foi excluído.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/fichas-tecnicas'));
    expect(
      await screen.findByRole('heading', { name: 'Fichas técnicas', level: 1 }),
    ).toBeInTheDocument();
  });

  it('explains how many sales use a product that cannot be deleted, and offers to discontinue it', async () => {
    const user = userEvent.setup();
    let discontinued = false;
    serve();
    server.use(
      http.delete(`${API}/composite-products/prod-baunilha`, () =>
        HttpResponse.json(
          apiErrorBody(422, 'ENTITY_IN_USE', {
            entityName: 'CompositeProduct',
            entityId: 'prod-baunilha',
            saleItems: 3,
            bomItems: 0,
            purchaseItems: 0,
            stockMovements: 0,
            stockLosses: 0,
            total: 3,
          }),
          { status: 422 },
        ),
      ),
      http.post(`${API}/composite-products/prod-baunilha/discontinue`, () => {
        discontinued = true;

        return HttpResponse.json(compositeProductDto({ isActive: false }));
      }),
    );
    await openProduct('prod-baunilha', 'Vela de baunilha');

    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }),
    );

    const dialog = await screen.findByRole('alertdialog', {
      name: 'Não dá para excluir este produto',
    });
    expect(within(dialog).getByText('Em uso em 3 vendas.')).toBeInTheDocument();
    expect(within(dialog).queryByText(/ENTITY_IN_USE/)).not.toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('button', { name: 'Descontinuar em vez de excluir' }),
    );

    expect(await screen.findByText('Vela de baunilha foi descontinuado.')).toBeInTheDocument();
    expect(discontinued).toBe(true);
  });
});

describe('the editor on a phone', () => {
  it('has no side column: the result is a summary that sticks to the top, with details a tap away', async () => {
    const user = userEvent.setup();
    setViewportWidth(PHONE_WIDTH);
    serve();
    await openProduct('prod-baunilha', 'Vela de baunilha');

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    const panel = resultPanel();

    expect(panel.getByText('Preço praticado')).toBeInTheDocument();
    expect(panel.getByText(`R$${SPACE}11,27`, VERBATIM)).toBeInTheDocument();
    expect(panel.getByText('3 unidades')).toBeInTheDocument();
    expect(panel.queryByText('Insumo gargalo')).not.toBeInTheDocument();

    await user.click(panel.getByRole('button', { name: 'Ver detalhes' }));

    expect(panel.getByText('Insumo gargalo')).toBeInTheDocument();
    expect(panel.getByRole('button', { name: 'Ocultar detalhes' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('keeps the whole task possible: fill, price and save, with the actions on screen', async () => {
    const user = userEvent.setup();
    setViewportWidth(PHONE_WIDTH);
    serve();
    await openNewProduct();

    await addMaterial(user, 'mat-cera');
    await user.type(screen.getByLabelText('Quantidade de Cera de soja por unidade'), '120');
    await user.type(screen.getByLabelText('Custo fixo por unidade'), '0');
    await user.type(screen.getByLabelText('Margem de lucro'), '100');

    expect(resultPanel().getByText(`R$${SPACE}6,72`, VERBATIM)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar ficha técnica' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('puts the result beside the form on a desktop', async () => {
    serve();
    await openProduct('prod-baunilha', 'Vela de baunilha');

    expect(screen.getByRole('complementary')).toBeInTheDocument();
    expect(
      within(screen.getByRole('complementary')).getByRole('region', {
        name: 'Resultado da ficha técnica',
      }),
    ).toBeInTheDocument();
  });
});
