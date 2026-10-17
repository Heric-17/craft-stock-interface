import { http, HttpResponse } from 'msw';

import type {
  SpendingDatasetDto,
  SpendingEstablishmentCellDto,
  SpendingPeriodCellDto,
  SpendingStockCellDto,
} from '@/features/spending/api/spending.dto';
import { env } from '@/shared/config/env';
import { requireDecimalString } from '@/shared/money';

import { apiErrorBody } from './materials';

const API = env.VITE_API_URL;

const dec = requireDecimalString;

export { apiErrorBody };

/**
 * The clock the screens of this file run on: the middle of October 2026, so the
 * running month is `2026-10` and the one before it `2026-09`.
 */
export const SPENDING_NOW = '2026-10-14T15:00:00-03:00';

/**
 * Six months of spending the way the API writes them, **without** a row for June:
 * the dataset only has months with spending, and the screen fills the gap.
 *
 * Worked by hand, because the tests quote these:
 *
 * - paid in the period: 300,00 + 450,50 + 200,00 + 1.000,00 + 1.180,00 = **3.130,50**
 * - purchases in the period: 3 + 4 + 2 + 5 + 6 = **20**
 * - saved: 12,00 + 20,00 + 0,00 + 50,00 + 30,50 = **112,50**
 * - October against September: (1.180,00 − 1.000,00) ÷ 1.000,00 = **+18,0%**
 * - October's average ticket: 1.180,00 ÷ 6 = 196,666… = **196,67**
 * - stock material: 2.191,35 of 3.130,50 = **70,0%**, and 939,15 only company expense
 *
 * The two sides of `byStockMaterial` count 17 and 9 purchases, 26 in all, for 20
 * real purchases: the ones with lines of both kinds are in each side.
 */
export const MONTHS_OF_SPENDING: SpendingPeriodCellDto[] = [
  { period: '2026-05', netSpend: dec('300.00'), discountTotal: dec('12.00'), purchaseCount: 3 },
  { period: '2026-07', netSpend: dec('450.50'), discountTotal: dec('20.00'), purchaseCount: 4 },
  { period: '2026-08', netSpend: dec('200.00'), discountTotal: dec('0.00'), purchaseCount: 2 },
  { period: '2026-09', netSpend: dec('1000.00'), discountTotal: dec('50.00'), purchaseCount: 5 },
  { period: '2026-10', netSpend: dec('1180.00'), discountTotal: dec('30.50'), purchaseCount: 6 },
];

const SHOPS: SpendingEstablishmentCellDto[] = [
  {
    establishmentId: '12345678000123',
    establishmentName: 'Casa das Essências',
    netSpend: dec('1500.00'),
    discountTotal: dec('60.00'),
    purchaseCount: 8,
  },
  {
    establishmentId: '98765432000199',
    establishmentName: 'Embalagens Aurora',
    netSpend: dec('900.50'),
    discountTotal: dec('30.50'),
    purchaseCount: 7,
  },
  // Only the CNPJ is known.
  {
    establishmentId: '11222333000144',
    establishmentName: null,
    netSpend: dec('400.00'),
    discountTotal: dec('12.00'),
    purchaseCount: 3,
  },
  // Purchases typed in with no shop.
  {
    establishmentId: null,
    establishmentName: null,
    netSpend: dec('330.00'),
    discountTotal: dec('10.00'),
    purchaseCount: 2,
  },
];

const STOCK_SPLIT: SpendingStockCellDto[] = [
  {
    isStockMaterial: true,
    netSpend: dec('2191.35'),
    discountTotal: dec('80.00'),
    purchaseCount: 17,
  },
  {
    isStockMaterial: false,
    netSpend: dec('939.15'),
    discountTotal: dec('32.50'),
    purchaseCount: 9,
  },
];

export function spendingDatasetDto(
  overrides: Partial<SpendingDatasetDto> = {},
): SpendingDatasetDto {
  return {
    from: '2026-05-01T03:00:00.000Z',
    to: '2026-11-01T03:00:00.000Z',
    granularity: 'MONTH',
    byPeriod: MONTHS_OF_SPENDING,
    byEstablishment: SHOPS,
    byStockMaterial: STOCK_SPLIT,
    ...overrides,
  };
}

/** A period where nothing was spent: every dimension empty, both sides of the split at zero. */
export const EMPTY_SPENDING = spendingDatasetDto({
  byPeriod: [],
  byEstablishment: [],
  byStockMaterial: [
    { isStockMaterial: true, netSpend: dec('0.00'), discountTotal: dec('0.00'), purchaseCount: 0 },
    { isStockMaterial: false, netSpend: dec('0.00'), discountTotal: dec('0.00'), purchaseCount: 0 },
  ],
});

/**
 * The dataset of a window. Months are cut to the window the way the API cuts
 * them — `from` inclusive, `to` exclusive, by the calendar of the business — and
 * the other two dimensions are the six-month ones whatever the window, because
 * only the six-month request reads them.
 */
export function spendingDatasetFor(from: string, to: string): SpendingDatasetDto {
  const first = from.slice(0, 7);
  const end = to.slice(0, 7);

  return spendingDatasetDto({
    byPeriod: MONTHS_OF_SPENDING.filter((cell) => cell.period >= first && cell.period < end),
  });
}

interface SpendingHandlerOptions {
  /** What `GET /purchases/spending` answers, given the window that was asked for. */
  dataset?: (from: string, to: string) => SpendingDatasetDto;
  /** Sees every URL the dataset is read with: which parameters went out. */
  onRequest?: (url: URL) => void;
  /** Makes the dataset fail with this status and body. */
  failure?: { status: number; body: ReturnType<typeof apiErrorBody> };
}

/**
 * The spending dataset route. Register it **before** the purchase routes: it is
 * `/purchases/spending`, and `/purchases/:id` would answer it first.
 */
export function spendingHandlers(options: SpendingHandlerOptions = {}) {
  const { dataset = spendingDatasetFor, onRequest, failure } = options;

  return [
    http.get(`${API}/purchases/spending`, ({ request }) => {
      const url = new URL(request.url);
      onRequest?.(url);

      if (failure !== undefined) {
        return HttpResponse.json(failure.body, { status: failure.status });
      }

      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      const granularity = url.searchParams.get('granularity');

      // The three are required, as in the API.
      if (from === null || to === null || (granularity !== 'DAY' && granularity !== 'MONTH')) {
        return HttpResponse.json(apiErrorBody(400, 'VALIDATION_FAILED'), { status: 400 });
      }

      return HttpResponse.json(dataset(from, to));
    }),
  ];
}
