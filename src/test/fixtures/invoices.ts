import { http, HttpResponse } from 'msw';

import type { ImportedInvoiceDto, PendingInvoiceDto } from '@/features/invoices/api/invoice.dto';
import type {
  PurchaseDetailDto,
  PurchaseItemDto,
  PurchaseSummaryDto,
} from '@/features/invoices/api/purchase.dto';
import { env } from '@/shared/config/env';
import { toIntOr } from '@/shared/lib/to-int';
import { requireDecimalString } from '@/shared/money';

import { apiErrorBody } from './materials';

const API = env.VITE_API_URL;

const dec = requireDecimalString;

export { apiErrorBody };

/** A capture the way the API writes one. By default: imported, a few days ago. */
export function pendingInvoiceDto(overrides: Partial<PendingInvoiceDto> = {}): PendingInvoiceDto {
  return {
    id: 'cap00001-0000-4000-8000-000000000001',
    url: 'https://www.nfce.fazenda.sp.gov.br/qrcode?p=35241012345678000123650010000012341000012345|2|1|1|abc',
    status: 'IMPORTED',
    attemptCount: 1,
    lastAttemptAt: '2026-10-12T17:21:00.000Z',
    purchaseId: 'compra-0001',
    lastError: null,
    createdAt: '2026-10-12T17:20:00.000Z',
    ...overrides,
  };
}

/** Read and imported: ready for the second step. */
export const capturaImportada = pendingInvoiceDto();

/** The portal did not answer on the last attempt: `UNSTABLE`, retryable. */
export const capturaInstavel = pendingInvoiceDto({
  id: 'cap00002-0000-4000-8000-000000000002',
  status: 'UNSTABLE',
  attemptCount: 3,
  lastAttemptAt: '2026-10-12T12:06:00.000Z',
  purchaseId: null,
  lastError: 'The NFC-e source did not answer after 3 attempts.',
  createdAt: '2026-10-12T12:05:00.000Z',
});

/**
 * The portal answered with something the reader could not make a note of:
 * `PENDING` with an attempt on record, which is how the API parks it.
 */
export const capturaIlegivel = pendingInvoiceDto({
  id: 'cap00003-0000-4000-8000-000000000003',
  status: 'PENDING',
  attemptCount: 1,
  lastAttemptAt: '2026-10-11T10:16:00.000Z',
  purchaseId: null,
  lastError: 'The page is not a note.',
  createdAt: '2026-10-11T10:15:00.000Z',
});

/** Captured a moment ago and not tried yet: being read right now. */
export function capturaProcessando(overrides: Partial<PendingInvoiceDto> = {}): PendingInvoiceDto {
  return pendingInvoiceDto({
    id: 'cap00004-0000-4000-8000-000000000004',
    status: 'PENDING',
    attemptCount: 0,
    lastAttemptAt: null,
    purchaseId: null,
    lastError: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  });
}

export function importedInvoiceDto(
  overrides: Partial<ImportedInvoiceDto> = {},
): ImportedInvoiceDto {
  return {
    purchaseId: 'compra-1111',
    pendingInvoiceId: 'cap00005-0000-4000-8000-000000000005',
    merchantName: 'Casa das Essências',
    ...overrides,
  };
}

/**
 * A purchase of the history the way the API writes one. Figures worked by hand:
 * R$ 253,90 of lines with R$ 5,00 of discount is R$ 248,90 paid.
 */
export function purchaseSummaryDto(
  overrides: Partial<PurchaseSummaryDto> = {},
): PurchaseSummaryDto {
  return {
    id: 'compra-0001',
    purchaseDate: '2026-10-12T17:20:00.000Z',
    accessKey: '35261012345678000123650010000012341000012345',
    establishment: { id: '12345678000123', name: 'Casa das Essências', cnpj: '12345678000123' },
    grossTotal: dec('253.90'),
    discountTotal: dec('5.00'),
    netTotal: dec('248.90'),
    allocationPending: false,
    itemCount: 8,
    hasInvoice: true,
    createdAt: '2026-10-12T17:25:00.000Z',
    ...overrides,
  };
}

export const compraCasaDasEssencias = purchaseSummaryDto();

export const compraEmbalagensAurora = purchaseSummaryDto({
  id: 'compra-0002',
  purchaseDate: '2026-10-09T12:06:00.000Z',
  accessKey: '35261098765432000199650010000099991000054321',
  establishment: { id: '98765432000199', name: 'Embalagens Aurora', cnpj: '98765432000199' },
  grossTotal: dec('96.30'),
  discountTotal: dec('0.00'),
  netTotal: dec('96.30'),
  itemCount: 1,
});

/** A purchase typed in by hand: no note behind it, no access key. */
export const compraDigitada = purchaseSummaryDto({
  id: 'compra-0003',
  purchaseDate: '2026-10-05T15:00:00.000Z',
  accessKey: null,
  establishment: null,
  grossTotal: dec('40.00'),
  discountTotal: dec('0.00'),
  netTotal: dec('40.00'),
  allocationPending: true,
  itemCount: 3,
  hasInvoice: false,
});

interface InvoicesHandlerOptions {
  invoices?: PendingInvoiceDto[];
  /** The purchase history, newest first. */
  purchases?: PurchaseSummaryDto[];
  /** Sees every URL the purchase history is read with. */
  onPurchasesRequest?: (url: URL) => void;
  /** Sees every URL the queue is read with: which parameters went out. */
  onRequest?: (url: URL) => void;
  /** Sees every address sent to `POST /invoices/imports`. */
  onImport?: (url: string) => void;
  /** Sees the id of every capture sent to `/reprocess`. */
  onReprocess?: (id: string) => void;
}

/**
 * The default answers of the invoice routes. The queue is paginated and
 * filtered the way the API does it — the filter runs before the page, `total`
 * is the size of the filtered set, and a `limit` above 100 is a 400.
 *
 * A capture that is reprocessed becomes `IMPORTED` in the kept state, so the
 * next read of the queue says what the real one would.
 */
export function invoicesHandlers(options: InvoicesHandlerOptions = {}) {
  const {
    invoices = [capturaInstavel, capturaIlegivel],
    purchases = [compraCasaDasEssencias, compraEmbalagensAurora, compraDigitada],
    onPurchasesRequest,
    onRequest,
    onImport,
    onReprocess,
  } = options;
  const state = invoices.map((invoice) => structuredClone(invoice));

  return [
    http.get(`${API}/purchases`, ({ request }) => {
      const url = new URL(request.url);
      onPurchasesRequest?.(url);

      const limit = toIntOr(url.searchParams.get('limit'), 20);
      const offset = toIntOr(url.searchParams.get('offset'), 0);

      if (limit < 1 || limit > 100) {
        return HttpResponse.json(apiErrorBody(400, 'VALIDATION_FAILED'), { status: 400 });
      }

      // `from` inclusive, `to` exclusive: the filter runs before the page, as in the API.
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      const establishmentId = url.searchParams.get('establishmentId');
      const filtered = purchases.filter(
        (purchase) =>
          (from === null || new Date(purchase.purchaseDate) >= new Date(from)) &&
          (to === null || new Date(purchase.purchaseDate) < new Date(to)) &&
          (establishmentId === null || purchase.establishment?.id === establishmentId),
      );

      return HttpResponse.json({
        items: filtered.slice(offset, offset + limit),
        total: filtered.length,
        limit,
        offset,
      });
    }),
    http.get(`${API}/invoices/pending`, ({ request }) => {
      const url = new URL(request.url);
      onRequest?.(url);

      const limit = toIntOr(url.searchParams.get('limit'), 20);
      const offset = toIntOr(url.searchParams.get('offset'), 0);

      if (limit < 1 || limit > 100) {
        return HttpResponse.json(apiErrorBody(400, 'VALIDATION_FAILED'), { status: 400 });
      }

      const status = url.searchParams.get('status');
      const filtered = state.filter((invoice) => status === null || invoice.status === status);

      return HttpResponse.json({
        items: filtered.slice(offset, offset + limit),
        total: filtered.length,
        limit,
        offset,
      });
    }),
    http.post(`${API}/invoices/imports`, async ({ request }) => {
      const body = (await request.json()) as { url: string };
      onImport?.(body.url);

      return HttpResponse.json(importedInvoiceDto(), { status: 201 });
    }),
    http.post(`${API}/invoices/pending/:id/reprocess`, ({ params }) => {
      const id = String(params.id);
      onReprocess?.(id);

      const found = state.find((invoice) => invoice.id === id);

      if (found === undefined) {
        return HttpResponse.json(apiErrorBody(422, 'INVALID_PENDING_INVOICE'), { status: 422 });
      }

      found.status = 'IMPORTED';
      found.purchaseId = 'compra-2222';

      return HttpResponse.json(
        importedInvoiceDto({ purchaseId: 'compra-2222', pendingInvoiceId: id }),
      );
    }),
  ];
}

/** A line of a purchase the way the API writes one: a company expense, not stock yet. */
export function purchaseItemDto(overrides: Partial<PurchaseItemDto> = {}): PurchaseItemDto {
  return {
    id: 'item-farinha',
    materialId: null,
    code: '7891000100103',
    description: 'FARINHA DE TRIGO 1KG',
    quantity: 2,
    unit: 'UND9',
    unitPrice: dec('10.00'),
    grossValue: dec('20.00'),
    allocatedDiscount: dec('0.00'),
    netValue: dec('20.00'),
    isCompanyExpense: true,
    isStockMaterial: false,
    ...overrides,
  };
}

export const itemFarinha = purchaseItemDto();

export const itemQueijo = purchaseItemDto({
  id: 'item-queijo',
  code: '7891000200204',
  description: 'QUEIJO MUSSARELA',
  quantity: 1,
  unit: 'PCT9',
  unitPrice: dec('7.00'),
  grossValue: dec('7.00'),
  netValue: dec('7.00'),
});

export const itemSacola = purchaseItemDto({
  id: 'item-sacola',
  code: '7891000300305',
  description: 'SACOLA PLASTICA',
  quantity: 1,
  unit: 'UND9',
  unitPrice: dec('3.00'),
  grossValue: dec('3.00'),
  netValue: dec('3.00'),
});

/**
 * A freshly imported note with a discount: R$ 30,00 of lines, R$ 6,00 off, R$ 24,00 paid.
 * Every line is a company expense that is not stock, and the discount is
 * `PROPORTIONAL` — the provisional mode the API gives an import.
 */
export function purchaseDetailDto(overrides: Partial<PurchaseDetailDto> = {}): PurchaseDetailDto {
  return {
    id: 'compra-1',
    purchaseDate: '2026-10-12T17:20:00.000Z',
    accessKey: '35261012345678000123650010000012341000012345',
    establishment: { id: '12345678000123', name: 'Casa das Essências', cnpj: '12345678000123' },
    grossTotal: dec('30.00'),
    discountTotal: dec('6.00'),
    netTotal: dec('24.00'),
    discountAllocationMode: 'PROPORTIONAL',
    allocationPending: false,
    createdAt: '2026-10-12T17:25:00.000Z',
    items: [itemFarinha, itemQueijo, itemSacola],
    ...overrides,
  };
}

/** The same note without any discount: the question is never asked. */
export const notaSemDesconto = purchaseDetailDto({
  discountTotal: dec('0.00'),
  netTotal: dec('30.00'),
});

interface ClassificationHandlersOptions {
  purchase?: PurchaseDetailDto;
  /** Sees every body sent to the classification. */
  onClassify?: (purchaseId: string, body: unknown) => void;
  /** Makes the classification fail with this body and status. */
  classifyFailure?: { status: number; body: ReturnType<typeof apiErrorBody> };
  /** Sees every URL the purchase is read with. */
  onPurchaseRequest?: (id: string) => void;
}

/**
 * The routes of the second step: the purchase with its lines and the
 * classification. A purchase that is not the one given is a 404, as the API
 * answers for an id it does not know.
 */
export function classificationHandlers(options: ClassificationHandlersOptions = {}) {
  const {
    purchase = purchaseDetailDto(),
    onClassify,
    classifyFailure,
    onPurchaseRequest,
  } = options;

  return [
    http.get(`${API}/purchases/:id`, ({ params }) => {
      onPurchaseRequest?.(String(params.id));

      return params.id === purchase.id
        ? HttpResponse.json(purchase)
        : HttpResponse.json(apiErrorBody(404, 'PURCHASE_NOT_FOUND'), { status: 404 });
    }),
    http.post(`${API}/invoices/purchases/:id/classification`, async ({ request, params }) => {
      onClassify?.(String(params.id), await request.json());

      if (classifyFailure !== undefined) {
        return HttpResponse.json(classifyFailure.body, { status: classifyFailure.status });
      }

      return HttpResponse.json(
        importedInvoiceDto({ purchaseId: String(params.id), pendingInvoiceId: null }),
      );
    }),
  ];
}
