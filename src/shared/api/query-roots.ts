/**
 * The first segment of every query key, one per feature that owns server data.
 *
 * Each feature builds its key factory on its own root, and a mutation in one
 * feature that changes what another feature shows invalidates that other root
 * from here. Features may only reach each other through their `index.ts`, so
 * the roots live in `shared/` instead of a feature importing a sibling's
 * private key factory — which would also drag the sibling's screens into its
 * bundle.
 */
export const QUERY_ROOTS = {
  materials: 'materials',
  compositeProducts: 'composite-products',
  shortages: 'shortages',
  sales: 'sales',
  invoices: 'invoices',
  // Read by the spending and purchases screens; an imported note creates a
  // purchase, so the invoice mutations invalidate them from here.
  purchases: 'purchases',
  spending: 'spending',
} as const;
