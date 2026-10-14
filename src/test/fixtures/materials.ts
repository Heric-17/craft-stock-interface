import { http, HttpResponse } from 'msw';

import type {
  InventorySummaryDto,
  MaterialDto,
  MaterialPriceHistoryDto,
} from '@/features/materials/api/material.dto';
import { env } from '@/shared/config/env';
import { requireDecimalString } from '@/shared/money';

const API = env.VITE_API_URL;

const dec = requireDecimalString;

/**
 * A `MaterialView` the way the backend writes one: money as decimal strings,
 * quantities as numbers, the fractional cost with four places and the stock
 * value already rounded per material.
 */
export function materialDto(overrides: Partial<MaterialDto> = {}): MaterialDto {
  return {
    id: 'mat-cera',
    name: 'Cera de soja',
    description: null,
    imageUrl: null,
    packageCost: dec('28.00'),
    packageQuantity: 1000,
    consumptionUnit: 'GRAM',
    consumptionUnitSymbol: 'g',
    stockQuantity: 680,
    minimumStockAlert: 300,
    unitCost: dec('0.0280'),
    stockValue: dec('19.04'),
    lowStock: false,
    isActive: true,
    discontinuedAt: null,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    ...overrides,
  };
}

export const cera = materialDto();

export const essencia = materialDto({
  id: 'mat-essencia',
  name: 'Essência baunilha',
  packageCost: dec('38.00'),
  packageQuantity: 100,
  consumptionUnit: 'MILLILITER',
  consumptionUnitSymbol: 'ml',
  stockQuantity: 18,
  minimumStockAlert: 25,
  unitCost: dec('0.3800'),
  stockValue: dec('6.84'),
  lowStock: true,
});

export const pavio = materialDto({
  id: 'mat-pavio',
  name: 'Pavio encerado',
  packageCost: dec('21.00'),
  packageQuantity: 100,
  consumptionUnit: 'UNIT',
  consumptionUnitSymbol: 'un',
  stockQuantity: 64,
  minimumStockAlert: 30,
  unitCost: dec('0.2100'),
  stockValue: dec('13.44'),
});

export const velaAntiga = materialDto({
  id: 'mat-antiga',
  name: 'Fragrância antiga',
  isActive: false,
  discontinuedAt: '2026-09-20T15:00:00.000Z',
  stockQuantity: 0,
  stockValue: dec('0.00'),
  lowStock: true,
});

export const inventorySummary: InventorySummaryDto = {
  materialCount: 3,
  belowMinimumCount: 1,
  totalStockValue: dec('39.32'),
};

export const priceHistory: MaterialPriceHistoryDto[] = [
  {
    id: 'ph-1',
    materialId: 'mat-cera',
    previousValue: dec('0.00'),
    newValue: dec('24.00'),
    origin: 'CREATION',
    changedAt: '2026-09-01T12:00:00.000Z',
  },
  {
    id: 'ph-2',
    materialId: 'mat-cera',
    previousValue: dec('24.00'),
    newValue: dec('28.00'),
    origin: 'INVOICE_SYNC',
    changedAt: '2026-09-15T12:00:00.000Z',
  },
  {
    id: 'ph-3',
    materialId: 'mat-cera',
    previousValue: dec('28.00'),
    newValue: dec('30.00'),
    origin: 'MANUAL_EDIT',
    changedAt: '2026-10-02T12:00:00.000Z',
  },
];

/** What a failed request carries: the documented error body, with the details of its code. */
export function apiErrorBody(
  statusCode: number,
  code: string,
  details?: unknown,
  extra: Record<string, unknown> = {},
) {
  return {
    statusCode,
    code,
    error: `${code}Error`,
    message: 'Message in English, for the log.',
    ...(details === undefined ? {} : { details }),
    path: '/materials',
    timestamp: '2026-10-12T12:00:00.000Z',
    correlationId: 'corr-1',
    ...extra,
  };
}

/**
 * The default answers of the materials routes, for a screen test that does not
 * care about most of them. `onRequest` sees every URL the list and summary
 * receive, which is how a test checks which parameters went out.
 */
export function materialsHandlers(
  options: {
    materials?: MaterialDto[];
    summary?: InventorySummaryDto;
    onRequest?: (url: URL) => void;
  } = {},
) {
  const { materials = [cera, essencia, pavio], summary = inventorySummary, onRequest } = options;

  return [
    http.get(`${API}/materials`, ({ request }) => {
      const url = new URL(request.url);
      onRequest?.(url);

      const name = url.searchParams.get('name')?.toLowerCase();
      const withDiscontinued = url.searchParams.get('includeDiscontinued') === 'true';

      return HttpResponse.json(
        materials.filter(
          (material) =>
            (withDiscontinued || material.isActive) &&
            (name === undefined || material.name.toLowerCase().includes(name)),
        ),
      );
    }),
    http.get(`${API}/materials/inventory-summary`, ({ request }) => {
      onRequest?.(new URL(request.url));

      return HttpResponse.json(summary);
    }),
    http.get(`${API}/materials/:id`, ({ params }) => {
      const found = materials.find((material) => material.id === params.id);

      return found === undefined
        ? HttpResponse.json(apiErrorBody(422, 'MATERIAL_NOT_FOUND'), { status: 422 })
        : HttpResponse.json(found);
    }),
    http.get(`${API}/materials/:id/price-history`, () => HttpResponse.json(priceHistory)),
  ];
}
