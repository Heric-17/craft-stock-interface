import { http, HttpResponse } from 'msw';

import type {
  SaleDto,
  SaleItemDto,
  SalePageDto,
  SalesDatasetDto,
} from '@/features/sales/api/sale.dto';
import { env } from '@/shared/config/env';
import { businessMonthLabel } from '@/shared/format';
import { toIntOr } from '@/shared/lib/to-int';
import { requireDecimalString } from '@/shared/money';

import { apiErrorBody } from './materials';

const API = env.VITE_API_URL;

const dec = requireDecimalString;

export { apiErrorBody };

/**
 * A `SaleView` the way the backend writes one: money as decimal strings,
 * quantities as numbers, the line total and the unit price already derived
 * from the frozen fraction. The figures are worked out by hand — not by the
 * code under test — so a fixture is a worked example.
 */
export function saleDto(overrides: Partial<SaleDto> = {}): SaleDto {
  return {
    id: 'aaaa1111-0000-4000-8000-000000000001',
    customerName: 'Marina Souza',
    customerContact: '11 99999-0000',
    paymentMethod: 'Pix',
    paymentStatus: 'PENDING',
    productionStatus: 'PENDING',
    items: [snapshotVela(), ceraAvulsa()],
    totalAmount: dec('24.03'),
    createdAt: '2026-10-12T14:32:00.000Z',
    updatedAt: '2026-10-12T14:32:00.000Z',
    ...overrides,
  };
}

/**
 * Two velas sold at R$ 10,00 each, under the name they had that day. The
 * product is called "Vela de baunilha" today and sells for R$ 11,27, and
 * nothing on the sale may show either.
 */
export function snapshotVela(overrides: Partial<SaleItemDto> = {}): SaleItemDto {
  return {
    id: 'item-vela',
    compositeProductId: 'prod-baunilha',
    materialId: null,
    quantity: 2,
    itemNameSnapshot: 'Vela Baunilha Clássica',
    priceBasisAmount: dec('10.00'),
    priceBasisQuantity: 1,
    // A product is always sold by the piece.
    consumptionUnit: 'UNIT',
    consumptionUnitSymbol: 'un',
    unitPrice: dec('10.0000'),
    lineTotal: dec('20.00'),
    ...overrides,
  };
}

/**
 * 120 g of a R$ 28,00 kilo of cera, sold at a 20% margin: the package is
 * priced at R$ 33,60, and 33,60 x 120 / 1000 = 4,032 -> R$ 4,03.
 */
export function ceraAvulsa(overrides: Partial<SaleItemDto> = {}): SaleItemDto {
  return {
    id: 'item-cera',
    compositeProductId: null,
    materialId: 'mat-cera',
    quantity: 120,
    itemNameSnapshot: 'Cera de soja',
    priceBasisAmount: dec('33.60'),
    priceBasisQuantity: 1000,
    // The unit the line was sold in, frozen with the price.
    consumptionUnit: 'GRAM',
    consumptionUnitSymbol: 'g',
    unitPrice: dec('0.0336'),
    lineTotal: dec('4.03'),
    ...overrides,
  };
}

export const vendaMarina = saleDto();

/** Paid and assembled: the stock was debited when it was assembled. */
export const vendaJoao = saleDto({
  id: 'bbbb2222-0000-4000-8000-000000000002',
  customerName: 'João Pereira',
  customerContact: null,
  paymentMethod: 'Dinheiro',
  paymentStatus: 'PAID',
  productionStatus: 'ASSEMBLED',
  items: [
    snapshotVela({
      id: 'item-kit',
      compositeProductId: 'prod-kit',
      quantity: 1,
      itemNameSnapshot: 'Kit presente',
      priceBasisAmount: dec('60.00'),
      unitPrice: dec('60.0000'),
      lineTotal: dec('60.00'),
    }),
  ],
  totalAmount: dec('60.00'),
  createdAt: '2026-10-10T10:18:00.000Z',
  updatedAt: '2026-10-11T10:18:00.000Z',
});

/** Paid and delivered: 30 ml of a R$ 38,00 bottle of 100 ml is R$ 11,40. */
export const vendaAna = saleDto({
  id: 'cccc3333-0000-4000-8000-000000000003',
  customerName: 'Ana Lima',
  customerContact: null,
  paymentMethod: 'Cartão',
  paymentStatus: 'PAID',
  productionStatus: 'DELIVERED',
  items: [
    ceraAvulsa({
      id: 'item-essencia',
      materialId: 'mat-essencia',
      quantity: 30,
      itemNameSnapshot: 'Essência baunilha',
      priceBasisAmount: dec('38.00'),
      priceBasisQuantity: 100,
      consumptionUnit: 'MILLILITER',
      consumptionUnitSymbol: 'ml',
      unitPrice: dec('0.3800'),
      lineTotal: dec('11.40'),
    }),
  ],
  totalAmount: dec('11.40'),
  createdAt: '2026-09-28T16:45:00.000Z',
  updatedAt: '2026-09-30T16:45:00.000Z',
});

/**
 * The dataset of `api-contract.md` section 8.1 for the two months the page asks
 * for. The month cells follow the real clock, because the page reads "this
 * month" from it: the current one sold R$ 2.071,00 and the one before it
 * R$ 1.840,50, a change of +12,5%.
 *
 * The open sales are the **balance**: 7 orders still to make or deliver, and
 * R$ 485,30 unpaid, from any date. The status cells of the period are
 * deliberately different (R$ 90,00 unpaid) so a card that read them would show
 * a number that is wrong on sight.
 */
export function salesDataset(from: string, to: string): SalesDatasetDto {
  return {
    from,
    to,
    byMonth: [
      { month: from.slice(0, 7), saleCount: 12, totalAmount: dec('1840.50') },
      { month: businessMonthLabel(), saleCount: 14, totalAmount: dec('2071.00') },
    ],
    byPaymentStatus: [
      { paymentStatus: 'PENDING', saleCount: 1, totalAmount: dec('90.00') },
      { paymentStatus: 'PAID', saleCount: 25, totalAmount: dec('3821.50') },
    ],
    byProductionStatus: [
      { productionStatus: 'PENDING', saleCount: 1, totalAmount: dec('90.00') },
      { productionStatus: 'ASSEMBLED', saleCount: 0, totalAmount: dec('0.00') },
      { productionStatus: 'DELIVERED', saleCount: 25, totalAmount: dec('3821.50') },
    ],
    openItems: [
      {
        paymentStatus: 'PENDING',
        productionStatus: 'PENDING',
        saleCount: 2,
        totalAmount: dec('220.00'),
      },
      {
        paymentStatus: 'PENDING',
        productionStatus: 'ASSEMBLED',
        saleCount: 1,
        totalAmount: dec('75.30'),
      },
      {
        paymentStatus: 'PENDING',
        productionStatus: 'DELIVERED',
        saleCount: 1,
        totalAmount: dec('190.00'),
      },
      {
        paymentStatus: 'PAID',
        productionStatus: 'PENDING',
        saleCount: 3,
        totalAmount: dec('310.20'),
      },
      {
        paymentStatus: 'PAID',
        productionStatus: 'ASSEMBLED',
        saleCount: 1,
        totalAmount: dec('60.00'),
      },
    ],
  };
}

interface SalesHandlerOptions {
  sales?: SaleDto[];
  /** What `GET /sales/analytics` answers, given the window that was asked for. */
  dataset?: (from: string, to: string) => SalesDatasetDto;
  /** Sees every URL the list and the dataset receive: which parameters went out. */
  onRequest?: (url: URL) => void;
  /** Sees the body of every status change that was sent: which request went out, and with what. */
  onWrite?: (write: { path: string; body: unknown }) => void;
}

/**
 * The default answers of the sales routes. The list is paginated and filtered
 * the way the API does it — the filter runs before the page, and `total` is
 * the size of the filtered set — and refuses a `limit` above 100 with a 400.
 *
 * Production and payment changes are kept in `sales`, so the next `GET` answers
 * what the `PATCH` did, which is how the real thing behaves. Writes that need
 * a worked answer (a new sale, a changed quantity) are the test's own handlers.
 */
export function salesHandlers(options: SalesHandlerOptions = {}) {
  const {
    sales = [vendaMarina, vendaJoao, vendaAna],
    dataset = salesDataset,
    onRequest,
    onWrite,
  } = options;
  const state = sales.map((sale) => structuredClone(sale));

  const find = (id: unknown) => state.find((sale) => sale.id === id);
  const notFound = () => HttpResponse.json(apiErrorBody(422, 'SALE_NOT_FOUND'), { status: 422 });

  return [
    http.get(`${API}/sales/analytics`, ({ request }) => {
      const url = new URL(request.url);
      onRequest?.(url);

      return HttpResponse.json(
        dataset(url.searchParams.get('from') ?? '', url.searchParams.get('to') ?? ''),
      );
    }),
    http.get(`${API}/sales`, ({ request }) => {
      const url = new URL(request.url);
      onRequest?.(url);

      const limit = toIntOr(url.searchParams.get('limit'), 20);
      const offset = toIntOr(url.searchParams.get('offset'), 0);

      if (limit < 1 || limit > 100) {
        return HttpResponse.json(apiErrorBody(400, 'VALIDATION_FAILED'), { status: 400 });
      }

      const paymentStatus = url.searchParams.get('paymentStatus');
      const productionStatus = url.searchParams.get('productionStatus');
      const filtered = state.filter(
        (sale) =>
          (paymentStatus === null || sale.paymentStatus === paymentStatus) &&
          (productionStatus === null || sale.productionStatus === productionStatus),
      );

      const page: SalePageDto = {
        items: filtered.slice(offset, offset + limit),
        total: filtered.length,
        limit,
        offset,
      };

      return HttpResponse.json(page);
    }),
    http.get(`${API}/sales/:id`, ({ params }) => {
      const found = find(params.id);

      return found === undefined ? notFound() : HttpResponse.json(found);
    }),
    http.patch(`${API}/sales/:id/payment-status`, async ({ params, request }) => {
      const found = find(params.id);

      if (found === undefined) {
        return notFound();
      }

      const body = (await request.json()) as Pick<SaleDto, 'paymentStatus'>;
      onWrite?.({ path: new URL(request.url).pathname, body });
      found.paymentStatus = body.paymentStatus;

      return HttpResponse.json(found);
    }),
    http.patch(`${API}/sales/:id/production-status`, async ({ params, request }) => {
      const found = find(params.id);

      if (found === undefined) {
        return notFound();
      }

      const body = (await request.json()) as Pick<SaleDto, 'productionStatus'>;
      onWrite?.({ path: new URL(request.url).pathname, body });
      found.productionStatus = body.productionStatus;

      return HttpResponse.json(found);
    }),
  ];
}
