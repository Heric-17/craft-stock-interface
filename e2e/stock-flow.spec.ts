import { expect, test, type Page } from '@playwright/test';

import { signIn, uniqueName } from './support/session';

/**
 * The core path of the product, through the real screens and the real API: a material
 * is registered and stocked, a bill of materials is assembled from it and shows its
 * bottleneck, and a sale moves the stock when its production status leaves "Pendente".
 *
 * Numbers are asserted as the API returns them. The only arithmetic here is the
 * expectation written down in advance: 1 kg in stock, 200 g per unit, two units sold.
 */
test.describe.configure({ mode: 'serial' });

const material = uniqueName('Farinha');
const product = uniqueName('Bolo');
let saleUrl = '';
let materialUrl = '';

async function openMaterial(page: Page): Promise<void> {
  await page.goto('/insumos');
  await page.getByRole('searchbox', { name: 'Buscar insumo' }).fill(material);
  await page.getByRole('link', { name: material }).click();
  materialUrl = page.url();
}

/** Opens the material and waits for its stock line to read exactly . */
async function expectStockOnHand(page: Page, expected: RegExp): Promise<void> {
  await page.goto(materialUrl);
  await expect(page.getByRole('region', { name: 'Estoque' })).toContainText(expected);
}

test.describe('stock flow', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('registers a material and gives it stock', async ({ page }) => {
    await page.goto('/insumos');
    await page.getByRole('button', { name: 'Novo insumo' }).click();

    const form = page.getByRole('dialog', { name: 'Novo insumo' });
    await form.getByRole('textbox', { name: 'Nome' }).fill(material);
    await form.getByLabel('Unidade de consumo').selectOption('GRAM');
    await form.getByRole('textbox', { name: 'Quanto a embalagem contém' }).fill('1000');
    await form.getByRole('textbox', { name: 'Custo da embalagem' }).fill('28,00');
    await form.getByRole('textbox', { name: 'Estoque mínimo' }).fill('100');

    // The echo is the promise of what will be sent.
    await expect(form.getByText('Entendido como 1 kg')).toBeVisible();
    await expect(form.getByText('Entendido como R$ 28,00')).toBeVisible();

    await form.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Insumo cadastrado.')).toBeVisible();

    await openMaterial(page);
    const detail = page.getByRole('dialog', { name: 'Detalhes do insumo' });
    await expect(detail.getByText('R$ 28,00/kg')).toBeVisible();

    await detail.getByRole('button', { name: 'Dar entrada' }).click();
    const entry = page.getByRole('dialog', { name: 'Ajustar estoque' });
    await entry.getByRole('textbox', { name: 'Quantidade que entrou' }).fill('1000');
    await entry.getByRole('button', { name: 'Registrar entrada' }).click();
    await expect(entry).toBeHidden();

    await expectStockOnHand(page, /Atual:\s1\skg/);
  });

  test('assembles a bill of materials and shows the bottleneck', async ({ page }) => {
    await page.goto('/fichas-tecnicas/nova');

    await page.getByRole('button', { name: 'Adicionar insumo' }).click();
    await page
      .getByRole('dialog', { name: 'Adicionar insumo à ficha' })
      .getByRole('button', { name: material })
      .click();

    await page.getByRole('textbox', { name: 'Nome do produto' }).fill(product);
    await page.getByRole('textbox', { name: `Quantidade de ${material} por unidade` }).fill('200');
    await page.getByRole('textbox', { name: 'Custo fixo por unidade' }).fill('2,00');
    await page.getByRole('textbox', { name: 'Margem de lucro' }).fill('50');

    const result = page.getByRole('region', { name: 'Resultado da ficha técnica' });
    await expect(result.getByText('Prévia', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Salvar ficha técnica' }).click();

    // After saving, the screen shows what the system calculated, not the preview.
    await expect(result.getByText('Salvo', { exact: true })).toBeVisible();
    await expect(result.getByText('Dá para produzir')).toBeVisible();
    await expect(result.getByText('5 unidades')).toBeVisible();
    await expect(result.getByText('Insumo gargalo')).toBeVisible();
    await expect(result.getByText(material)).toBeVisible();
    await expect(result.getByText('R$ 11,40').first()).toBeVisible();
  });

  test('registers a sale, assembles it and the stock is debited', async ({ page }) => {
    await page.goto('/vendas/nova');
    await page.getByRole('textbox', { name: 'Cliente' }).fill('Maria');
    await page.getByRole('textbox', { name: 'Forma de pagamento' }).fill('Pix');

    await page.getByRole('button', { name: 'Adicionar item' }).click();
    await page
      .getByRole('dialog', { name: 'Adicionar item à venda' })
      .getByRole('button', { name: product })
      .click();
    await page.getByRole('textbox', { name: `Quantidade de ${product}` }).fill('2');
    await page.getByRole('button', { name: 'Registrar venda' }).click();

    await expect(page).toHaveURL(/\/vendas\/[0-9a-f-]{36}$/);
    saleUrl = page.url();
    await expect(page.getByText('R$ 22,80').first()).toBeVisible();

    await page.getByRole('radio', { name: 'Montado' }).click();
    await page
      .getByRole('alertdialog', { name: 'Marcar esta venda como montada?' })
      .getByRole('button', { name: 'Marcar como montada' })
      .click();
    await expect(page.getByRole('radio', { name: 'Montado' })).toBeChecked();

    // 1 kg - 2 x 200 g.
    await expectStockOnHand(page, /Atual:\s600\sg/);
  });

  test('puts the sale back to pending and the stock comes back', async ({ page }) => {
    await page.goto(saleUrl);

    const production = page.getByRole('radiogroup', { name: 'Produção' });
    await production.getByRole('radio', { name: 'Pendente' }).click();
    // The confirmation says what comes back; its safe button is the first, the action the last.
    await page.getByRole('alertdialog').getByRole('button').last().click();
    await expect(production.getByRole('radio', { name: 'Pendente' })).toBeChecked();

    await expectStockOnHand(page, /Atual:\s1\skg/);
  });
});
