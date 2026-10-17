import { lazy } from 'react';

/**
 * One chunk per feature, downloaded the first time its route is opened.
 *
 * Each import goes through the feature's `index.ts`, the only door a feature
 * has, so splitting by feature never means reaching into one. Nothing else
 * imports these features statically: a static import elsewhere would pull the
 * feature back into the main bundle and the split would be for nothing.
 */
export const MaterialsPage = lazy(async () => ({
  default: (await import('@/features/materials')).MaterialsPage,
}));

export const MaterialLossesPage = lazy(async () => ({
  default: (await import('@/features/materials')).MaterialLossesPage,
}));

export const CompositeProductsPage = lazy(async () => ({
  default: (await import('@/features/composite-products')).CompositeProductsPage,
}));

export const CompositeProductEditorPage = lazy(async () => ({
  default: (await import('@/features/composite-products')).CompositeProductEditorPage,
}));

export const SalesPage = lazy(async () => ({
  default: (await import('@/features/sales')).SalesPage,
}));

export const SaleDetailPage = lazy(async () => ({
  default: (await import('@/features/sales')).SaleDetailPage,
}));

export const NewSalePage = lazy(async () => ({
  default: (await import('@/features/sales')).NewSalePage,
}));

export const InvoiceImportPage = lazy(async () => ({
  default: (await import('@/features/invoices')).InvoiceImportPage,
}));

export const InvoiceClassificationPage = lazy(async () => ({
  default: (await import('@/features/invoices')).InvoiceClassificationPage,
}));

export const ShortagesPage = lazy(async () => ({
  default: (await import('@/features/shortages')).ShortagesPage,
}));

export const SpendingPage = lazy(async () => ({
  default: (await import('@/features/spending')).SpendingPage,
}));

export const PurchasesPage = lazy(async () => ({
  default: (await import('@/features/spending')).PurchasesPage,
}));

export const PurchaseDetailPage = lazy(async () => ({
  default: (await import('@/features/spending')).PurchaseDetailPage,
}));

export const ActivityPage = lazy(async () => ({
  default: (await import('@/features/activity')).ActivityPage,
}));

export const SettingsPage = lazy(async () => ({
  default: (await import('@/features/settings')).SettingsPage,
}));
