import {
  Activity,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  ScanLine,
  Settings,
  ShoppingBag,
  ReceiptText,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react';

export interface NavEntry {
  path: string;
  label: string;
  icon: LucideIcon;
}

/** A screen listed under a parent of the menu: a label and where it goes, with no icon of its own. */
export interface NavChild {
  path: string;
  label: string;
  /** Marked only on its own path, not on the screens below it. */
  end?: boolean;
}

/** An entry of the menu that opens a list instead of a screen. */
export interface NavParent {
  label: string;
  icon: LucideIcon;
  children: readonly NavChild[];
}

export type NavItem = NavEntry | NavParent;

export interface NavGroup {
  label: string;
  entries: readonly NavItem[];
}

export function isNavParent(item: NavItem): item is NavParent {
  return 'children' in item;
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
  purchases: { path: '/compras', label: 'Compras', icon: ReceiptText },
  activity: { path: '/atividades', label: 'Minhas atividades', icon: Activity },
  settings: { path: '/configuracoes', label: 'Configurações', icon: Settings },
} as const satisfies Record<string, NavEntry>;

/**
 * The screens a visitor can open without signing in. Visible text like the rest
 * of the address, so in Portuguese, and kept here with every other path. The
 * link in the password reset e-mail points at `resetPassword`: the API builds it
 * from `WEB_APP_URL`, so renaming this path means changing the API's side too.
 */
export const AUTH_ROUTES = {
  login: '/login',
  forgotPassword: '/esqueci-senha',
  resetPassword: '/redefinir-senha',
} as const;

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
 * The screens under "Vendas", as segments of its path: registering one and
 * opening one. Visible text like the rest of the address, so in Portuguese, and
 * kept here with every other path.
 */
export const SALE_ROUTES = {
  new: 'nova',
  detail: ':id',
} as const;

/**
 * The screens under "Compras", as segments of its path: opening one. Visible text
 * like the rest of the address, so in Portuguese, and kept here with every other path.
 */
export const PURCHASE_ROUTES = {
  detail: ':id',
} as const;

/**
 * Where one purchase opens. Absolute, because it is linked from two screens at
 * different depths — the spending panel and the list of purchases.
 */
export function purchasePath(purchaseId: string): string {
  return `${NAV.purchases.path}/${encodeURIComponent(purchaseId)}`;
}

/**
 * The screens under "Importar nota", as segments of its path: the second step of
 * an import, which classifies the purchase the first one produced. Visible text
 * like the rest of the address, so in Portuguese, and kept here with every other
 * path. The notes that were already imported are the list of purchases.
 */
export const INVOICE_ROUTES = {
  classify: 'classificar/:purchaseId',
} as const;

/**
 * Where the second step of one purchase is. Absolute, because it is linked from
 * two screens at different depths — the capture screen and the list of
 * purchases — and a relative one would mean a different place from each.
 */
export function classificationPath(purchaseId: string): string {
  return `${NAV.invoices.path}/${INVOICE_ROUTES.classify.replace(':purchaseId', encodeURIComponent(purchaseId))}`;
}

/**
 * The screens under "Insumos", as segments of its path: the loss history. Visible
 * text like the rest of the address, so in Portuguese, and kept here with every
 * other path.
 */
export const MATERIAL_ROUTES = {
  losses: 'perdas',
} as const;

/**
 * "Insumos" in the menu: the stock itself, what was lost from it and what is
 * missing from it. Three screens about the same thing, so they open from one
 * entry. Each keeps its own path; only the menu groups them.
 */
const MATERIALS_MENU: NavParent = {
  label: NAV.materials.label,
  icon: NAV.materials.icon,
  children: [
    { path: NAV.materials.path, label: 'Estoque', end: true },
    { path: `${NAV.materials.path}/${MATERIAL_ROUTES.losses}`, label: 'Perdas' },
    { path: NAV.shortages.path, label: NAV.shortages.label },
  ],
};

/** The groups of the mockups, in the order they are drawn. */
export const NAV_GROUPS: readonly NavGroup[] = [
  { label: 'Operação', entries: [NAV.invoices] },
  { label: 'Produção', entries: [MATERIALS_MENU, NAV.compositeProducts] },
  { label: 'Comercial', entries: [NAV.sales] },
  { label: 'Financeiro', entries: [NAV.spending, NAV.purchases] },
];

/** Below the groups, above the signed-in user. */
export const ACCOUNT_ENTRIES: readonly NavEntry[] = [NAV.activity, NAV.settings];

/** Where `/` goes: the screen most visits start from, importing an invoice at the counter. */
export const HOME_PATH = NAV.invoices.path;
