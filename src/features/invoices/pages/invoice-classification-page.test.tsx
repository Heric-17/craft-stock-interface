import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { env } from '@/shared/config/env';
import { requireDecimalString as dec } from '@/shared/money';
import {
  apiErrorBody,
  classificationHandlers,
  itemFarinha,
  itemQueijo,
  itemSacola,
  notaSemDesconto,
  purchaseDetailDto,
  purchaseItemDto,
} from '@/test/fixtures/invoices';
import { cera, materialsHandlers, velaAntiga } from '@/test/fixtures/materials';
import { server } from '@/test/msw/server';
import { renderClassification } from '@/test/render-classification';
import { PHONE_WIDTH, setViewportWidth } from '@/test/viewport';

const API = env.VITE_API_URL;

type User = ReturnType<typeof userEvent.setup>;

interface Opened {
  user: User;
  bodies: unknown[];
}

/** The second step over an API that has the note, two materials and a classification that answers. */
async function open(options: Parameters<typeof classificationHandlers>[0] = {}): Promise<Opened> {
  const user = userEvent.setup();
  const bodies: unknown[] = [];

  server.use(
    ...classificationHandlers({ onClassify: (_id, body) => bodies.push(body), ...options }),
    ...materialsHandlers({ materials: [cera, velaAntiga] }),
  );
  renderClassification();
  await screen.findByRole('heading', { name: 'Itens da nota', level: 2 });

  return { user, bodies };
}

const line = (name: string) => within(screen.getByRole('region', { name }));
const concludeButton = () => screen.getByRole('button', { name: 'Concluir classificação' });
const FARINHA = 'FARINHA DE TRIGO 1KG';
const QUEIJO = 'QUEIJO MUSSARELA';
const SACOLA = 'SACOLA PLASTICA';

/** Marks a line as a stock material and points it at Cera de soja, with a package of 500 g. */
async function stockWithCera(user: User, name = FARINHA, quantity = '500') {
  await user.click(line(name).getByRole('checkbox', { name: 'Insumo de estoque' }));
  await user.click(line(name).getByRole('button', { name: 'Escolher insumo' }));
  await user.click(await screen.findByRole('button', { name: 'Cera de soja' }));
  const field = line(name).getByLabelText('Quanto cabe em cada embalagem');
  await user.clear(field);
  await user.type(field, quantity);
}

async function confirm(user: User) {
  await user.click(concludeButton());
  const dialog = await screen.findByRole('alertdialog');
  await user.click(within(dialog).getByRole('button', { name: 'Concluir' }));
}

describe('the note being classified', () => {
  it('shows the shop, the day and the three figures the API gave', async () => {
    await open();

    const header = within(
      screen.getByRole('heading', { name: 'Casa das Essências', level: 2 }).closest('section')!,
    );

    expect(header.getByText('Valor bruto').nextSibling).toHaveTextContent('R$ 30,00');
    expect(header.getByText('Desconto').nextSibling).toHaveTextContent('R$ 6,00');
    expect(header.getByText('Valor pago').nextSibling).toHaveTextContent('R$ 24,00');
  });

  it('shows each line with its quantity and unit labelled as they came on the note', async () => {
    await open();

    expect(line(FARINHA).getByText('Como veio na nota: 2 UN')).toBeVisible();
    expect(line(QUEIJO).getByText('Como veio na nota: 1 PCT')).toBeVisible();
    expect(line(SACOLA).getByText('R$ 3,00')).toBeVisible();
  });

  it('explains that the cost of an insumo uses the full value and only goes up', async () => {
    await open();

    expect(
      screen.getByText(/O custo usa o valor cheio da linha, sem o desconto, e só é atualizado/),
    ).toBeVisible();
  });

  it('says so when the note does not exist', async () => {
    server.use(...classificationHandlers(), ...materialsHandlers());
    renderClassification('compra-que-nao-existe');

    expect(await screen.findByText('Nota não encontrada')).toBeVisible();
  });

  it('shows the support code and a way to try again when the note cannot be read', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(
        `${API}/purchases/:id`,
        () =>
          HttpResponse.json(
            apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'err-789' }),
            {
              status: 500,
            },
          ),
        { once: true },
      ),
      ...classificationHandlers(),
      ...materialsHandlers(),
    );
    renderClassification();

    expect(await screen.findByText('Não foi possível carregar a nota')).toBeVisible();
    expect(screen.getByText('err-789')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByRole('heading', { name: 'Itens da nota' })).toBeVisible();
  });
});

describe('a note without a discount', () => {
  it('does not ask how to spread it, and does not send a mode', async () => {
    const { user, bodies } = await open({ purchase: notaSemDesconto });

    expect(screen.queryByText('Desconto da nota')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();

    await confirm(user);

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).not.toHaveProperty('discountAllocationMode');
    expect(bodies[0]).not.toHaveProperty('manualAllocation');
  });
});

describe('the two answers of each line', () => {
  it('marking a line as stock marks it as a company expense and fixes that mark', async () => {
    const { user } = await open();
    await user.click(line(SACOLA).getByRole('checkbox', { name: 'Gasto da empresa' }));
    expect(line(SACOLA).getByRole('checkbox', { name: 'Gasto da empresa' })).not.toBeChecked();

    await user.click(line(SACOLA).getByRole('checkbox', { name: 'Insumo de estoque' }));

    const expense = line(SACOLA).getByRole('checkbox', { name: 'Gasto da empresa' });
    expect(expense).toBeChecked();
    expect(expense).toBeDisabled();
  });

  it('unmarking the company expense unmarks the stock material with it', async () => {
    const { user } = await open();
    const stock = () => line(QUEIJO).getByRole('checkbox', { name: 'Insumo de estoque' });
    await user.click(stock());
    await user.click(stock());
    expect(stock()).not.toBeChecked();

    await user.click(line(QUEIJO).getByRole('checkbox', { name: 'Gasto da empresa' }));
    await user.click(line(QUEIJO).getByRole('checkbox', { name: 'Gasto da empresa' }));

    expect(stock()).not.toBeChecked();
  });

  it('writes nothing while the answers are given: a stock line sent twice would enter the stock twice', async () => {
    const { user, bodies } = await open();

    await stockWithCera(user);
    await user.click(line(QUEIJO).getByRole('checkbox', { name: 'Gasto da empresa' }));
    await user.click(line(QUEIJO).getByRole('checkbox', { name: 'Gasto da empresa' }));

    expect(bodies).toEqual([]);
  });
});

describe('a stock line', () => {
  it('cannot be concluded until the material and the package are answered', async () => {
    const { user } = await open();
    await user.click(line(FARINHA).getByRole('checkbox', { name: 'Insumo de estoque' }));

    expect(concludeButton()).toBeDisabled();
    expect(concludeButton()).toHaveAccessibleDescription(
      'Falta completar os insumos de estoque marcados acima.',
    );
    expect(line(FARINHA).getByText('Falta completar')).toBeVisible();
  });

  it('offers only active materials, with their photo cards, and links the one picked', async () => {
    const { user, bodies } = await open();
    await user.click(line(FARINHA).getByRole('checkbox', { name: 'Insumo de estoque' }));
    await user.click(line(FARINHA).getByRole('button', { name: 'Escolher insumo' }));

    expect(await screen.findByRole('button', { name: 'Cera de soja' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Fragrância antiga' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cera de soja' }));

    expect(line(FARINHA).getByText('Cera de soja')).toBeVisible();
    // The package of the material is the suggestion, to be confirmed on the field.
    const field = line(FARINHA).getByLabelText('Quanto cabe em cada embalagem');
    expect(field).toHaveValue('1000');
    expect(line(FARINHA).getByText('1 kg')).toBeVisible();

    await user.clear(field);
    await user.type(field, '500');
    expect(line(FARINHA).getByText('500 g')).toBeVisible();
    expect(concludeButton()).toBeEnabled();

    await confirm(user);

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      items: [
        {
          itemId: 'item-farinha',
          isCompanyExpense: true,
          isStockMaterial: true,
          materialId: 'mat-cera',
          packageQuantity: 500,
        },
        { itemId: 'item-queijo', isCompanyExpense: true, isStockMaterial: false },
        { itemId: 'item-sacola', isCompanyExpense: true, isStockMaterial: false },
      ],
      discountAllocationMode: 'PROPORTIONAL',
    });
  });

  it('sends the package typed in kilos as the grams it is', async () => {
    const { user, bodies } = await open({ purchase: notaSemDesconto });
    await stockWithCera(user, FARINHA, '1');
    await user.click(line(FARINHA).getByRole('button', { name: 'kg' }));
    const field = line(FARINHA).getByLabelText('Quanto cabe em cada embalagem');
    await user.clear(field);
    await user.type(field, '1,5');

    expect(line(FARINHA).getByText('1,5 kg')).toBeVisible();

    await confirm(user);

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(JSON.stringify(bodies[0])).toContain('"packageQuantity":1500');
  });

  it('refuses a package with a fourth decimal place on the field instead of rounding it', async () => {
    const { user } = await open();
    await stockWithCera(user, FARINHA, '0,1451');

    expect(line(FARINHA).getByLabelText('Quanto cabe em cada embalagem')).toBeInvalid();
    expect(line(FARINHA).getByText(/Não entendi esse valor/)).toBeVisible();
    expect(concludeButton()).toBeDisabled();
  });

  it('creates the material right there, from its name, its unit and its package', async () => {
    const { user, bodies } = await open({ purchase: notaSemDesconto });
    await user.click(line(QUEIJO).getByRole('checkbox', { name: 'Insumo de estoque' }));
    await user.click(line(QUEIJO).getByRole('radio', { name: 'Criar insumo novo' }));

    // The package cannot be typed before there is a unit to read it in.
    expect(line(QUEIJO).queryByLabelText('Quanto cabe em cada embalagem')).not.toBeInTheDocument();

    await user.type(line(QUEIJO).getByLabelText('Nome do insumo novo'), 'Queijo mussarela');
    await user.selectOptions(line(QUEIJO).getByLabelText('Unidade de consumo'), 'GRAM');
    await user.type(line(QUEIJO).getByLabelText('Quanto cabe em cada embalagem'), '200');

    expect(line(QUEIJO).getByText('200 g')).toBeVisible();

    await user.click(concludeButton());
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('1 insumo recebe entrada no estoque.')).toBeVisible();
    expect(within(dialog).getByText('1 insumo novo será criado.')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Concluir' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    const sent = bodies[0] as { items: { itemId: string }[] };
    expect(sent.items.find((item) => item.itemId === 'item-queijo')).toEqual({
      itemId: 'item-queijo',
      isCompanyExpense: true,
      isStockMaterial: true,
      newMaterial: { name: 'Queijo mussarela', consumptionUnit: 'GRAM' },
      packageQuantity: 200,
    });
  });

  it('shows what concluding will do, and goes to the list of notes when it is done', async () => {
    const { user } = await open({ purchase: notaSemDesconto });
    await stockWithCera(user);
    await user.click(line(SACOLA).getByRole('checkbox', { name: 'Gasto da empresa' }));

    await user.click(concludeButton());
    const dialog = await screen.findByRole('alertdialog');

    expect(within(dialog).getByText('1 insumo recebe entrada no estoque.')).toBeVisible();
    expect(within(dialog).getByText('2 itens entram nos gastos da empresa.')).toBeVisible();
    expect(within(dialog).getByText('1 item fica de fora, como gasto pessoal.')).toBeVisible();
    expect(within(dialog).getByText(/A entrada no estoque não se desfaz/)).toBeVisible();

    await user.click(within(dialog).getByRole('button', { name: 'Concluir' }));

    expect(await screen.findByText('Tela das compras')).toBeVisible();
    expect(await screen.findByText('Nota classificada.')).toBeVisible();
  });

  it('refreshes the note after concluding, so the history reads what was saved', async () => {
    const reads: string[] = [];
    const { user } = await open({
      purchase: notaSemDesconto,
      onPurchaseRequest: (id) => reads.push(id),
    });
    const before = reads.length;

    await confirm(user);

    expect(await screen.findByText('Tela das compras')).toBeVisible();
    // The purchase read by this very screen was invalidated, not left stale.
    expect(reads.length).toBeGreaterThan(before);
  });
});

describe('a line the API has already entered into the stock', () => {
  const entered = purchaseDetailDto({
    items: [
      purchaseItemDto({ ...itemFarinha, isStockMaterial: true, materialId: 'mat-cera' }),
      itemQueijo,
    ],
    discountTotal: notaSemDesconto.discountTotal,
    netTotal: notaSemDesconto.netTotal,
  });

  it('is shown as done, cannot be changed and is never sent again', async () => {
    const { user, bodies } = await open({ purchase: entered });

    const done = line(FARINHA);
    expect(done.getByText(/já deu entrada no estoque de Cera de soja/)).toBeVisible();
    expect(done.getByRole('checkbox', { name: 'Gasto da empresa' })).toBeDisabled();
    expect(done.getByRole('checkbox', { name: 'Insumo de estoque' })).toBeDisabled();

    await confirm(user);

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      items: [{ itemId: 'item-queijo', isCompanyExpense: true, isStockMaterial: false }],
    });
  });

  it('leaves nothing to conclude when every line was already entered', async () => {
    await open({
      purchase: purchaseDetailDto({
        items: [purchaseItemDto({ ...itemFarinha, isStockMaterial: true, materialId: 'mat-cera' })],
        grossTotal: itemFarinha.grossValue,
        discountTotal: notaSemDesconto.discountTotal,
        netTotal: itemFarinha.grossValue,
      }),
    });

    expect(
      screen.queryByRole('button', { name: 'Concluir classificação' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Todos os itens desta nota já deram entrada no estoque.'),
    ).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Voltar para as compras' })).toHaveLength(2);
  });
});

describe('the way the discount is spread', () => {
  it('opens with the mode the API holds, and names the four ways', async () => {
    await open();

    expect(screen.getByRole('radio', { name: /Dividir entre todos os itens/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Só nos itens da empresa/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Só nos itens pessoais/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Informar item a item/ })).not.toBeChecked();
  });

  it('switches "only the personal items" off, with the reason, while every line is a company expense', async () => {
    const { user } = await open();
    const personal = () => screen.getByRole('radio', { name: /Só nos itens pessoais/ });

    expect(personal()).toBeDisabled();
    expect(personal()).toHaveAccessibleDescription(
      'Todos os itens estão marcados como gasto da empresa.',
    );

    await user.click(line(SACOLA).getByRole('checkbox', { name: 'Gasto da empresa' }));

    expect(personal()).toBeEnabled();
  });

  it('switches "only the company items" off, with the reason, while no line is one', async () => {
    const { user } = await open();

    for (const name of [FARINHA, QUEIJO, SACOLA]) {
      await user.click(line(name).getByRole('checkbox', { name: 'Gasto da empresa' }));
    }

    const company = screen.getByRole('radio', { name: /Só nos itens da empresa/ });
    expect(company).toBeDisabled();
    expect(company).toHaveAccessibleDescription('Nenhum item está marcado como gasto da empresa.');
  });

  it('asks again when the way chosen no longer has a line to land on', async () => {
    const { user } = await open({
      purchase: purchaseDetailDto({ discountAllocationMode: 'COMPANY_ONLY' }),
    });
    expect(screen.getByRole('radio', { name: /Só nos itens da empresa/ })).toBeChecked();
    expect(concludeButton()).toBeEnabled();

    for (const name of [FARINHA, QUEIJO, SACOLA]) {
      await user.click(line(name).getByRole('checkbox', { name: 'Gasto da empresa' }));
    }

    expect(screen.getByRole('radio', { name: /Só nos itens da empresa/ })).not.toBeChecked();
    expect(concludeButton()).toBeDisabled();
    expect(concludeButton()).toHaveAccessibleDescription(
      'Escolha como dividir o desconto da nota.',
    );
  });

  it('does not work out the share of any line: the automatic ways send only the mode', async () => {
    const { user, bodies } = await open();
    await user.click(screen.getByRole('radio', { name: /Só nos itens da empresa/ }));

    // No per-line amount is on the screen under an automatic way.
    expect(screen.queryByRole('group', { name: /Desconto de/ })).not.toBeInTheDocument();

    await confirm(user);

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ discountAllocationMode: 'COMPANY_ONLY' });
    expect(bodies[0]).not.toHaveProperty('manualAllocation');
  });
});

describe('informing the discount line by line', () => {
  async function openManual() {
    const opened = await open();
    await opened.user.click(screen.getByRole('radio', { name: /Informar item a item/ }));

    return opened;
  }

  const amount = (name: string) =>
    within(screen.getByRole('group', { name: `Desconto de ${name}` })).getByLabelText(
      'Desconto atribuído',
    );

  it('counts what was attributed against the discount, and blocks until it closes exactly', async () => {
    const { user } = await openManual();

    expect(screen.getByText('Atribuído R$ 0,00 de R$ 6,00')).toBeVisible();
    expect(concludeButton()).toBeDisabled();
    expect(concludeButton()).toHaveAccessibleDescription(
      'Distribua todo o desconto entre os itens para concluir.',
    );

    await user.type(amount(FARINHA), '4');
    await user.type(amount(QUEIJO), '1,99');

    expect(screen.getByText('Atribuído R$ 5,99 de R$ 6,00')).toBeVisible();
    expect(screen.getByText('Faltam R$ 0,01.')).toBeVisible();
    expect(concludeButton()).toBeDisabled();

    await user.clear(amount(QUEIJO));
    await user.type(amount(QUEIJO), '2,01');

    expect(screen.getByText('Atribuído R$ 6,01 de R$ 6,00')).toBeVisible();
    expect(screen.getByText('Passou R$ 0,01.')).toBeVisible();
    expect(concludeButton()).toBeDisabled();

    await user.clear(amount(QUEIJO));
    await user.type(amount(QUEIJO), '2');

    expect(screen.getByText('Atribuído R$ 6,00 de R$ 6,00')).toBeVisible();
    expect(concludeButton()).toBeEnabled();
  });

  it('adds cents without float drift', async () => {
    const { user } = await openManual();

    await user.type(amount(FARINHA), '0,10');
    await user.type(amount(QUEIJO), '0,20');

    expect(screen.getByText('Atribuído R$ 0,30 de R$ 6,00')).toBeVisible();
  });

  it('stops a line at its own value', async () => {
    const { user } = await openManual();

    await user.type(amount(SACOLA), '3,01');

    expect(amount(SACOLA)).toBeInvalid();
    expect(screen.getByText('O desconto não pode passar do valor do item.')).toBeVisible();
    expect(
      screen.getByText('Valor do item R$ 3,00: o desconto não pode passar disso.'),
    ).toBeVisible();

    await user.clear(amount(SACOLA));
    await user.type(amount(SACOLA), '3');

    expect(amount(SACOLA)).toBeValid();
  });

  it('refuses a third decimal place instead of rounding it', async () => {
    const { user } = await openManual();

    await user.type(amount(FARINHA), '1,005');

    expect(amount(FARINHA)).toBeInvalid();
    expect(concludeButton()).toBeDisabled();
  });

  it('sends the amounts as the echo showed them, only for the lines that got something', async () => {
    const { user, bodies } = await openManual();

    await user.type(amount(FARINHA), '4');
    await user.type(amount(QUEIJO), '2');
    expect(
      within(screen.getByRole('group', { name: `Desconto de ${FARINHA}` })).getByText('R$ 4,00'),
    ).toBeVisible();

    await confirm(user);

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      discountAllocationMode: 'MANUAL',
      manualAllocation: [
        { itemId: 'item-farinha', allocatedDiscount: '4.00' },
        { itemId: 'item-queijo', allocatedDiscount: '2.00' },
      ],
    });
  });

  it('opens with what the API attributed when the note was already informed line by line', async () => {
    await open({
      purchase: purchaseDetailDto({
        discountAllocationMode: 'MANUAL',
        items: [
          purchaseItemDto({ ...itemFarinha, allocatedDiscount: dec('4.00') }),
          purchaseItemDto({ ...itemQueijo, allocatedDiscount: dec('2.00') }),
          itemSacola,
        ],
      }),
    });

    expect(screen.getByText('Atribuído R$ 6,00 de R$ 6,00')).toBeVisible();
    expect(concludeButton()).toBeEnabled();
  });
});

describe('a pending attribution', () => {
  const pending = purchaseDetailDto({ allocationPending: true, discountAllocationMode: 'MANUAL' });

  it('is flagged by a fixed warning that says the purchase is out of the spending panel', async () => {
    await open({ purchase: pending });

    const warning = screen.getByRole('alert');
    expect(warning).toHaveTextContent('O desconto desta nota está pendente.');
    expect(warning).toHaveTextContent('fica fora do painel de gastos');
  });

  it('blocks the conclusion until the discount is spread again', async () => {
    const { user, bodies } = await open({ purchase: pending });

    // The mode the API holds was invalidated: none is chosen.
    expect(
      screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked),
    ).toBe(true);
    expect(concludeButton()).toBeDisabled();
    expect(concludeButton()).toHaveAccessibleDescription(
      'Escolha como dividir o desconto da nota.',
    );

    await user.click(screen.getByRole('radio', { name: /Dividir entre todos os itens/ }));

    expect(concludeButton()).toBeEnabled();

    await confirm(user);

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ discountAllocationMode: 'PROPORTIONAL' });
  });
});

describe('when the API refuses the discount', () => {
  async function refuse(code: string, details: unknown) {
    const opened = await open({
      classifyFailure: { status: 422, body: apiErrorBody(422, code, details) },
    });
    await confirm(opened.user);

    return opened;
  }

  it('says why in the section of the discount, with the amounts from details as money', async () => {
    await refuse('DISCOUNT_ALLOCATION', {
      reason: 'SUM_MISMATCH',
      expected: '6.00',
      provided: '4.50',
    });

    const section = within(screen.getByText('Desconto da nota').closest('section')!);
    expect(
      await section.findByText('O desconto distribuído não fecha com o desconto da nota.'),
    ).toBeVisible();
    expect(section.getByText('Distribuído R$ 4,50 de R$ 6,00.')).toBeVisible();
    expect(section.getByText('Nada foi salvo. Ajuste a divisão e conclua de novo.')).toBeVisible();
    // The question stays on screen: the person is still on this note.
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('uses the sentence of the reason it was given', async () => {
    await refuse('DISCOUNT_ALLOCATION', {
      reason: 'NO_ELIGIBLE_LINE',
      mode: 'PERSONAL_ONLY',
      expected: '6.00',
    });

    expect(
      await screen.findByText(
        'Nenhuma linha desta nota se encaixa na forma de distribuição escolhida.',
      ),
    ).toBeVisible();
  });

  it('flags a pending attribution the same way', async () => {
    await refuse('PENDING_DISCOUNT_ALLOCATION', {
      purchaseId: 'compra-1',
      expected: '6.00',
      provided: '0.00',
    });

    expect(
      await screen.findByText(
        'Distribua todo o desconto entre as linhas antes de concluir esta compra.',
      ),
    ).toBeVisible();
    expect(screen.getByText('Distribuído R$ 0,00 de R$ 6,00.')).toBeVisible();
  });

  it('clears the refusal as soon as the person changes the choice', async () => {
    const { user } = await refuse('DISCOUNT_ALLOCATION', {
      reason: 'SUM_MISMATCH',
      expected: '6.00',
      provided: '4.50',
    });
    await screen.findByText('Distribuído R$ 4,50 de R$ 6,00.');

    await user.click(screen.getByRole('radio', { name: /Só nos itens da empresa/ }));

    expect(screen.queryByText('Distribuído R$ 4,50 de R$ 6,00.')).not.toBeInTheDocument();
  });

  it('shows the support code of an unexpected failure in a toast, and stays on the note', async () => {
    const { user } = await open({
      classifyFailure: {
        status: 500,
        body: apiErrorBody(500, 'INTERNAL_ERROR', undefined, { errorId: 'err-classify-1' }),
      },
    });
    await confirm(user);

    expect(await screen.findByText(/err-classify-1/)).toBeVisible();
    expect(screen.queryByText('Tela das compras')).not.toBeInTheDocument();
  });
});

describe('leaving with choices that were not saved', () => {
  it('asks first, and keeps the choices when the person stays', async () => {
    const { user } = await open();
    await user.click(line(SACOLA).getByRole('checkbox', { name: 'Gasto da empresa' }));

    await user.click(screen.getByRole('link', { name: 'Cancelar' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Sair sem salvar?')).toBeVisible();
    expect(within(dialog).getByText(/a classificação desta nota será perdido/)).toBeVisible();

    await user.click(within(dialog).getByRole('button', { name: 'Continuar editando' }));

    expect(line(SACOLA).getByRole('checkbox', { name: 'Gasto da empresa' })).not.toBeChecked();
  });

  it('does not ask when nothing was changed', async () => {
    const { user } = await open();

    await user.click(screen.getByRole('link', { name: 'Cancelar' }));

    expect(await screen.findByText('Tela das compras')).toBeVisible();
  });
});

describe('on a phone', () => {
  it('keeps the whole task in the document: the lines, the discount and the way to conclude', async () => {
    setViewportWidth(PHONE_WIDTH);
    await open();

    expect(screen.getByRole('list', { name: 'Itens da nota' })).toBeVisible();
    expect(screen.getByRole('radiogroup')).toBeVisible();
    expect(concludeButton()).toBeVisible();
  });
});
