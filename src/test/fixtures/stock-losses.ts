import { http, HttpResponse } from 'msw';

import type {
  StockLossDatasetDto,
  StockLossDto,
  StockLossPageDto,
  StockLossResultDto,
} from '@/features/materials/api/stock-loss.dto';
import { env } from '@/shared/config/env';
import { toIntOr } from '@/shared/lib/to-int';
import { requireDecimalString } from '@/shared/money';

import { apiErrorBody } from './materials';

const API = env.VITE_API_URL;

const dec = requireDecimalString;

export { apiErrorBody };

/**
 * A loss the way the backend writes one. `value` is what the API derived from
 * the fraction it froze (`costBasisAmount / costBasisQuantity`): a fixture
 * spells it out, so a test can tell the API's figure from one the screen could
 * have computed.
 */
export function lossDto(overrides: Partial<StockLossDto> = {}): StockLossDto {
  return {
    id: 'loss-cera-1',
    materialId: 'mat-cera',
    materialName: 'Cera de soja',
    consumptionUnit: 'GRAM',
    consumptionUnitSymbol: 'g',
    quantity: 100,
    reason: 'BREAKAGE',
    observation: null,
    value: dec('2.80'),
    costBasisAmount: dec('28.00'),
    costBasisQuantity: 1000,
    createdAt: '2026-10-12T14:32:00.000Z',
    ...overrides,
  };
}

/** 100 g of cera at R$ 28,00 the kilo: R$ 2,80. */
export const ceraQuebrou = lossDto({ observation: 'caiu da prateleira' });

/** 6 ml of essência at R$ 38,00 the 100 ml: R$ 2,28. */
export const essenciaVenceu = lossDto({
  id: 'loss-essencia-1',
  materialId: 'mat-essencia',
  materialName: 'Essência baunilha',
  consumptionUnit: 'MILLILITER',
  consumptionUnitSymbol: 'ml',
  quantity: 6,
  reason: 'EXPIRED',
  value: dec('2.28'),
  costBasisAmount: dec('38.00'),
  costBasisQuantity: 100,
  createdAt: '2026-10-11T10:18:00.000Z',
});

/** 50 g of cera: R$ 1,40. */
export const ceraQuebrouDeNovo = lossDto({
  id: 'loss-cera-2',
  quantity: 50,
  value: dec('1.40'),
  createdAt: '2026-10-10T09:00:00.000Z',
});

/** 10 ml of essência: R$ 3,80. */
export const essenciaVenceuDeNovo = lossDto({
  id: 'loss-essencia-2',
  materialId: 'mat-essencia',
  materialName: 'Essência baunilha',
  consumptionUnit: 'MILLILITER',
  consumptionUnitSymbol: 'ml',
  quantity: 10,
  reason: 'EXPIRED',
  value: dec('3.80'),
  costBasisAmount: dec('38.00'),
  costBasisQuantity: 100,
  createdAt: '2026-10-09T16:45:00.000Z',
});

/** One wick lost: R$ 21,00 for a pack of 100, R$ 0,21 each. */
export function pavioPerdido(index: number): StockLossDto {
  return lossDto({
    id: `loss-pavio-${String(index)}`,
    materialId: 'mat-pavio',
    materialName: 'Pavio encerado',
    consumptionUnit: 'UNIT',
    consumptionUnitSymbol: 'un',
    quantity: 1,
    reason: 'LOST',
    value: dec('0.21'),
    costBasisAmount: dec('21.00'),
    costBasisQuantity: 100,
    createdAt: '2026-10-08T12:00:00.000Z',
  });
}

/**
 * Twenty-two losses of one month, newest first: four of cera and essência, and
 * eighteen wicks. Twenty fit on the first page, so the list on screen is **not**
 * the whole month until the second page is read — which is the point of the
 * dataset.
 */
export const monthOfLosses: StockLossDto[] = [
  ceraQuebrou,
  essenciaVenceu,
  ceraQuebrouDeNovo,
  essenciaVenceuDeNovo,
  ...Array.from({ length: 18 }, (_, index) => pavioPerdido(index + 1)),
];

/**
 * What the API says about that month, worked out by hand from the losses above.
 *
 *   cera:     2 losses, 2,80 + 1,40                = 4,20   (BREAKAGE)
 *   essência: 2 losses, 2,28 + 3,80                = 6,08   (EXPIRED)
 *   pavio:   18 losses, 18 x 0,21                  = 3,78   (LOST)
 *   month:   22 losses, 4,20 + 6,08 + 3,78         = 14,06
 *
 * The 20 rows of the first page add up to R$ 13,64 (the four of cera and
 * essência, R$ 10,28, and sixteen wicks, R$ 3,36): not what was lost. Both pages
 * together are R$ 14,06, which is what the dataset says.
 */
export const monthDataset: StockLossDatasetDto = {
  from: '2025-11-01T03:00:00.000Z',
  to: '2026-11-01T03:00:00.000Z',
  byMonth: [
    { month: '2026-09', lossCount: 0, lossValue: dec('0.00') },
    { month: '2026-10', lossCount: 22, lossValue: dec('14.06') },
  ],
  byReason: [
    { reason: 'BREAKAGE', lossCount: 2, lossValue: dec('4.20') },
    { reason: 'EXPIRED', lossCount: 2, lossValue: dec('6.08') },
    { reason: 'SPOILAGE', lossCount: 0, lossValue: dec('0.00') },
    { reason: 'LOST', lossCount: 18, lossValue: dec('3.78') },
    { reason: 'OTHER', lossCount: 0, lossValue: dec('0.00') },
  ],
  byMaterial: [
    {
      materialId: 'mat-essencia',
      materialName: 'Essência baunilha',
      lossCount: 2,
      lossValue: dec('6.08'),
    },
    { materialId: 'mat-cera', materialName: 'Cera de soja', lossCount: 2, lossValue: dec('4.20') },
    {
      materialId: 'mat-pavio',
      materialName: 'Pavio encerado',
      lossCount: 18,
      lossValue: dec('3.78'),
    },
  ],
};

export const emptyDataset: StockLossDatasetDto = {
  from: '2025-11-01T03:00:00.000Z',
  to: '2026-11-01T03:00:00.000Z',
  byMonth: [{ month: '2026-10', lossCount: 0, lossValue: dec('0.00') }],
  byReason: ['BREAKAGE', 'EXPIRED', 'SPOILAGE', 'LOST', 'OTHER'].map((reason) => ({
    reason,
    lossCount: 0,
    lossValue: dec('0.00'),
  })),
  byMaterial: [],
};

/** What `POST /materials/:id/losses` answers: the loss and the balance that is left. */
export function lossResult(overrides: Partial<StockLossResultDto> = {}): StockLossResultDto {
  return {
    id: 'loss-new',
    materialId: 'mat-cera',
    materialName: 'Cera de soja',
    consumptionUnit: 'GRAM',
    consumptionUnitSymbol: 'g',
    quantity: 80,
    reason: 'BREAKAGE',
    observation: null,
    value: dec('2.24'),
    costBasisAmount: dec('28.00'),
    costBasisQuantity: 1000,
    createdAt: '2026-10-14T12:00:00.000Z',
    stockQuantityAfter: 600,
    ...overrides,
  };
}

interface LossesHandlerOptions {
  /** The API's state: the list answers from it, filtered and paged. */
  losses?: StockLossDto[];
  /** A function when the dataset follows the state, as the real one does after a deletion. */
  dataset?: StockLossDatasetDto | (() => StockLossDatasetDto);
  onRequest?: (url: URL) => void;
}

/**
 * The read routes of the loss history: the list, filtered and paged the way
 * the API does it — `total` is the size of the filtered set — and the dataset,
 * which is whatever the test says the API computed.
 */
export function lossesHandlers(options: LossesHandlerOptions = {}) {
  const { losses = monthOfLosses, dataset = monthDataset, onRequest } = options;

  return [
    http.get(`${API}/materials/losses/dataset`, ({ request }) => {
      onRequest?.(new URL(request.url));

      return HttpResponse.json(typeof dataset === 'function' ? dataset() : dataset);
    }),
    http.get(`${API}/materials/losses`, ({ request }) => {
      const url = new URL(request.url);
      onRequest?.(url);

      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      const materialId = url.searchParams.get('materialId');
      const reason = url.searchParams.get('reason');
      const limit = toIntOr(url.searchParams.get('limit'), 20);
      const offset = toIntOr(url.searchParams.get('offset'), 0);

      const filtered = losses.filter(
        (loss) =>
          (from === null || new Date(loss.createdAt) >= new Date(from)) &&
          (to === null || new Date(loss.createdAt) < new Date(to)) &&
          (materialId === null || loss.materialId === materialId) &&
          (reason === null || loss.reason === reason),
      );

      const page: StockLossPageDto = {
        items: filtered.slice(offset, offset + limit),
        total: filtered.length,
        limit,
        offset,
      };

      return HttpResponse.json(page);
    }),
  ];
}
