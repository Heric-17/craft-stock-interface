import {
  Activity,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  ScanLine,
  Settings,
  ShoppingBag,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react';

export interface NavEntry {
  path: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  entries: readonly NavEntry[];
}

/**
 * Every screen of the signed-in area, once. The sidebar, the breadcrumb and the
 * route table all read from here, so a label is spelled in one place and a
 * screen cannot be in the menu under one name and in the header under another.
 */
export const NAV = {
  invoices: { path: '/importar-nota', label: 'Importar nota', icon: ScanLine },
  materials: { path: '/insumos', label: 'Insumos', icon: Boxes },
  compositeProducts: { path: '/fichas-tecnicas', label: 'Fichas técnicas', icon: ClipboardList },
  sales: { path: '/vendas', label: 'Vendas', icon: ShoppingBag },
  shortages: { path: '/insumos-faltantes', label: 'Insumos faltantes', icon: ShoppingCart },
  spending: { path: '/gastos', label: 'Gastos da empresa', icon: CircleDollarSign },
  activity: { path: '/atividades', label: 'Minhas atividades', icon: Activity },
  settings: { path: '/configuracoes', label: 'Configurações', icon: Settings },
} as const satisfies Record<string, NavEntry>;

/**
 * The screens under "Fichas técnicas", as segments of its path. They are
 * visible text like the rest of the address, so they are in Portuguese, and
 * they live here with every other path instead of inside the components that
 * link to them.
 */
export const COMPOSITE_PRODUCT_ROUTES = {
  new: 'nova',
  detail: ':id',
} as const;

/**
 * The screens under "Insumos", as segments of its path: the loss history. Visible
 * text like the rest of the address, so in Portuguese, and kept here with every
 * other path.
 */
export const MATERIAL_ROUTES = {
  losses: 'perdas',
} as const;

/** The groups of the mockups, in the order they are drawn. */
export const NAV_GROUPS: readonly NavGroup[] = [
  { label: 'Operação', entries: [NAV.invoices] },
  { label: 'Estoque', entries: [NAV.materials, NAV.compositeProducts] },
  { label: 'Comercial', entries: [NAV.sales, NAV.shortages] },
  { label: 'Financeiro', entries: [NAV.spending] },
];

/** Below the groups, above the signed-in user. */
export const ACCOUNT_ENTRIES: readonly NavEntry[] = [NAV.activity, NAV.settings];

/** Where `/` goes: the screen most visits start from, importing an invoice at the counter. */
export const HOME_PATH = NAV.invoices.path;
