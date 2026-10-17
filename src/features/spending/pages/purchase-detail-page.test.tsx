import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { NON_BREAKING_SPACE } from '@/shared/format';
import {
  classificationHandlers,
  purchaseDetailDto,
  purchaseItemDto,
} from '@/test/fixtures/invoices';
import { server } from '@/test/msw/server';
import { renderSpending } from '@/test/render-spending';
import { VERBATIM } from '@/test/text';
import { PHONE_WIDTH, setViewportWidth } from '@/test/viewport';
import { requireDecimalString } from '@/shared/money';

const SPACE = NON_BREAKING_SPACE;
const dec = requireDecimalString;
const reais = (value: string) => `R$${SPACE}${value}`;

/**
 * R$ 30,00 of lines with R$ 6,00 off, R$ 24,00 paid. The flour became stock, the
 * cheese is not for the company, the bag is only a company expense — and the
 * discount sits on the first two.
 */
const farinha = purchaseItemDto({
  id: 'item-farinha',
  description: 'FARINHA DE TRIGO 1KG',
  grossValue: dec('20.00'),
  allocatedDiscount: dec('4.00'),
  netValue: dec('16.00'),
  isCompanyExpense: true,
  isStockMaterial: true,
});
const queijo = purchaseItemDto({
  id: 'item-queijo',
  description: 'QUEIJO MUSSARELA',
  quantity: 1,
  unit: 'PCT9',
  grossValue: dec('7.00'),
  allocatedDiscount: dec('2.00'),
  netValue: dec('5.00'),
  isCompanyExpense: false,
  isStockMaterial: false,
});
const sacola = purchaseItemDto({
  id: 'item-sacola',
  description: 'SACOLA PLASTICA',
  quantity: 1,
  grossValue: dec('3.00'),
  allocatedDiscount: dec('0.00'),
  netValue: dec('3.00'),
  isCompanyExpense: true,
  isStockMaterial: false,
});

const compra = purchaseDetailDto({ items: [farinha, queijo, sacola] });

function open(purchase = compra) {
  server.use(...classificationHandlers({ purchase }));

  return renderSpending(`/compras/${purchase.id}`);
}

async function lines() {
  return within(await screen.findByRole('table', { name: 'Itens da compra' }));
}

describe('the purchase detail', () => {
  it('says who it was bought from, when, and the three totals the API worked out', async () => {
    open();

    expect(await screen.findByRole('heading', { name: 'Casa das Essências' })).toBeVisible();
    expect(screen.getByText('12 out, 14:20')).toBeVisible();

    // "Valor bruto" is also a column of the lines, so the totals are read inside their own block.
    const summary = screen.getByRole('heading', { name: 'Casa das Essências' }).closest('section');
    const totals = within(summary as HTMLElement);

    expect(totals.getByText(reais('30,00'), VERBATIM)).toBeVisible();
    expect(totals.getByText(reais('6,00'), VERBATIM)).toBeVisible();
    expect(totals.getByText('Valor pago')).toBeVisible();
    expect(totals.getByText(reais('24,00'), VERBATIM)).toBeVisible();
  });

  it('lists each line with its full price, the discount attributed to it and what it cost after', async () => {
    open();

    const table = await lines();
    const row = within(table.getByText('FARINHA DE TRIGO 1KG').closest('tr') as HTMLElement);

    expect(row.getByText(reais('20,00'), VERBATIM)).toBeVisible();
    expect(row.getByText(reais('4,00'), VERBATIM)).toBeVisible();
    expect(row.getByText(reais('16,00'), VERBATIM)).toBeVisible();
    expect(table.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(
      ['Item', 'Classificação', 'Valor bruto', 'Desconto atribuído', 'Valor líquido', ''].filter(
        (name) => name !== '',
      ),
    );
  });

  it('shows the net value the API gave, not gross minus discount worked out on this side', async () => {
    // A value that is not 20,00 − 4,00: if the screen subtracted, it would say 16,00.
    open(
      purchaseDetailDto({
        items: [{ ...farinha, netValue: dec('15.99') }],
      }),
    );

    const row = within(
      (await lines()).getByText('FARINHA DE TRIGO 1KG').closest('tr') as HTMLElement,
    );

    expect(row.getByText(reais('15,99'), VERBATIM)).toBeVisible();
    expect(row.queryByText(reais('16,00'), VERBATIM)).not.toBeInTheDocument();
  });

  it('classifies each line: stock material, company expense, personal', async () => {
    open();

    const table = await lines();

    expect(
      within(table.getByText('FARINHA DE TRIGO 1KG').closest('tr') as HTMLElement).getByText(
        'Insumo de estoque',
      ),
    ).toBeVisible();
    expect(
      within(table.getByText('SACOLA PLASTICA').closest('tr') as HTMLElement).getByText(
        'Gasto da empresa',
      ),
    ).toBeVisible();
    expect(
      within(table.getByText('QUEIJO MUSSARELA').closest('tr') as HTMLElement).getByText(
        'Gasto pessoal',
      ),
    ).toBeVisible();
  });

  it('keeps how the note printed the quantity, as it came', async () => {
    open();

    const row = within(
      (await lines()).getByText('FARINHA DE TRIGO 1KG').closest('tr') as HTMLElement,
    );

    expect(row.getByText(/Como veio na nota: 2/)).toBeVisible();
  });

  it('leads to the classification to edit it', async () => {
    const user = userEvent.setup();
    open();

    const edit = await screen.findByRole('link', { name: /Editar classificação/ });

    expect(edit).toHaveAttribute('href', '/importar-nota/classificar/compra-1');

    await user.click(edit);

    expect(await screen.findByText('Tela da classificação da compra compra-1')).toBeVisible();
  });

  it('leads back to the list', async () => {
    open();

    expect(await screen.findByRole('link', { name: /Voltar para as compras/ })).toHaveAttribute(
      'href',
      '/compras',
    );
  });

  it('warns when the discount is still to be spread, and says it is not in the panel', async () => {
    open(purchaseDetailDto({ items: [farinha, queijo, sacola], allocationPending: true }));

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('Desconto a distribuir');
    expect(alert).toHaveTextContent('não entra nos números do painel de gastos');
  });

  it('says nothing about a discount to spread when there is none', async () => {
    open();

    await screen.findByRole('heading', { name: 'Casa das Essências' });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says the purchase was not found, with the way back', async () => {
    server.use(...classificationHandlers());
    renderSpending('/compras/compra-que-nao-existe');

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('Não foi possível abrir esta compra');
    expect(alert).toHaveTextContent('Compra não encontrada.');
    expect(screen.getByRole('link', { name: /Voltar para as compras/ })).toBeVisible();
  });

  it('is cards, with the same figures, on a phone', async () => {
    setViewportWidth(PHONE_WIDTH);
    open();

    const list = within(await screen.findByRole('list', { name: 'Itens da compra' }));

    expect(screen.queryByRole('table', { name: 'Itens da compra' })).not.toBeInTheDocument();
    expect(list.getAllByRole('listitem')).toHaveLength(3);

    const card = within(list.getByText('FARINHA DE TRIGO 1KG').closest('li') as HTMLElement);

    expect(card.getByText(reais('16,00'), VERBATIM)).toBeVisible();
    expect(card.getByText('Insumo de estoque')).toBeVisible();
    expect(screen.getByRole('link', { name: /Editar classificação/ })).toBeVisible();
  });
});
