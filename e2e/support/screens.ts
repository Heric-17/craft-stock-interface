import { expect, type Page } from '@playwright/test';

import type { Fixtures } from './fixtures';

/** Every route of the application, with whatever must be opened over it to be measured. */
export interface Screen {
  name: string;
  path: (fx: Fixtures) => string;
  /** Whatever must be opened on top of the screen before it is measured. */
  prepare?: (page: Page, fx: Fixtures) => Promise<void>;
}

export const SCREENS: Screen[] = [
  { name: 'Importar nota', path: () => '/importar-nota' },
  { name: 'Insumos', path: () => '/insumos' },
  { name: 'Insumos: detalhe', path: (fx) => `/insumos?insumo=${fx.materialId}` },
  {
    name: 'Insumos: novo insumo',
    path: () => '/insumos',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Novo insumo' }).click();
      await expect(page.getByRole('dialog', { name: 'Novo insumo' })).toBeVisible();
    },
  },
  {
    name: 'Insumos: ajustar estoque',
    path: () => '/insumos',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Ajustar estoque' }).click();
      await expect(page.getByRole('dialog', { name: 'Ajustar estoque' })).toBeVisible();
    },
  },
  { name: 'Perdas', path: () => '/insumos/perdas' },
  { name: 'Insumos faltantes', path: () => '/insumos-faltantes' },
  { name: 'Fichas técnicas', path: () => '/fichas-tecnicas' },
  { name: 'Ficha técnica: nova', path: () => '/fichas-tecnicas/nova' },
  { name: 'Ficha técnica: editar', path: (fx) => `/fichas-tecnicas/${fx.productId}` },
  {
    name: 'Ficha técnica: escolher insumo',
    path: () => '/fichas-tecnicas/nova',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Adicionar insumo' }).click();
      await expect(page.getByRole('dialog', { name: 'Adicionar insumo à ficha' })).toBeVisible();
    },
  },
  { name: 'Vendas', path: () => '/vendas' },
  { name: 'Venda: nova', path: () => '/vendas/nova' },
  {
    name: 'Venda: escolher item',
    path: () => '/vendas/nova',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Adicionar item' }).click();
      await expect(page.getByRole('dialog', { name: 'Adicionar item à venda' })).toBeVisible();
    },
  },
  { name: 'Venda: detalhe', path: (fx) => `/vendas/${fx.saleId}` },
  { name: 'Gastos da empresa', path: () => '/gastos' },
  { name: 'Compras', path: () => '/compras' },
  { name: 'Compra: detalhe', path: (fx) => `/compras/${fx.purchaseId}` },
  { name: 'Minhas atividades', path: () => '/atividades' },
  { name: 'Configurações', path: () => '/configuracoes' },
  { name: 'Página inexistente', path: () => '/esta-rota-nao-existe' },
];

/** Screens a visitor sees without signing in. */
export const PUBLIC_SCREENS: Pick<Screen, 'name' | 'path'>[] = [
  { name: 'Entrar', path: () => '/login' },
  { name: 'Esqueci a senha', path: () => '/esqueci-senha' },
  { name: 'Redefinir a senha', path: () => '/redefinir-senha?token=exemplo' },
];

/** Waits until the screen has what it came for, so it is measured with its content in. */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Carregando…')).toHaveCount(0);
}
