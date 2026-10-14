import { http, HttpResponse } from 'msw';

import type {
  BomItemDto,
  CompositeProductDto,
} from '@/features/composite-products/api/composite-product.dto';
import { env } from '@/shared/config/env';
import { requireDecimalString } from '@/shared/money';

import { apiErrorBody } from './materials';

const API = env.VITE_API_URL;

const dec = requireDecimalString;

export { apiErrorBody };

/**
 * A `CompositeProductView` the way the backend writes one: money as decimal
 * strings, quantities as numbers, the line's unit cost with four places and
 * everything derived already calculated.
 *
 * The figures below are worked out by hand from the materials of
 * `fixtures/materials.ts` and the formula of `pricing-formula.md`, so a
 * fixture is a worked example and not the output of the code under test.
 */
export function compositeProductDto(
  overrides: Partial<CompositeProductDto> = {},
): CompositeProductDto {
  return {
    id: 'prod-baunilha',
    name: 'Vela de baunilha',
    description: null,
    imageUrl: null,
    fixedOperationalCost: dec('2.50'),
    profitMarginBasisPoints: 3500,
    manualPrice: null,
    materialsCost: dec('5.85'),
    totalCost: dec('8.35'),
    suggestedPrice: dec('11.27'),
    finalPrice: dec('11.27'),
    productionCapacity: 3,
    bottleneck: { materialId: 'mat-essencia', materialName: 'Essência baunilha', possibleUnits: 3 },
    billOfMaterials: [ceraLine(), essenciaLine(), pavioLine()],
    isActive: true,
    discontinuedAt: null,
    createdAt: '2026-09-02T12:00:00.000Z',
    updatedAt: '2026-10-12T14:32:00.000Z',
    ...overrides,
  };
}

/** 120 g of a R$ 28,00 kilo: R$ 3,36. Stock 680 g allows 5. */
export function ceraLine(overrides: Partial<BomItemDto> = {}): BomItemDto {
  return {
    materialId: 'mat-cera',
    materialName: 'Cera de soja',
    quantity: 120,
    consumptionUnit: 'GRAM',
    consumptionUnitSymbol: 'g',
    unitCost: dec('0.0280'),
    lineCost: dec('3.36'),
    stockQuantity: 680,
    possibleUnits: 5,
    ...overrides,
  };
}

/** 6 ml of a R$ 38,00 bottle of 100 ml: R$ 2,28. Stock 18 ml allows 3 — the bottleneck. */
export function essenciaLine(overrides: Partial<BomItemDto> = {}): BomItemDto {
  return {
    materialId: 'mat-essencia',
    materialName: 'Essência baunilha',
    quantity: 6,
    consumptionUnit: 'MILLILITER',
    consumptionUnitSymbol: 'ml',
    unitCost: dec('0.3800'),
    lineCost: dec('2.28'),
    stockQuantity: 18,
    possibleUnits: 3,
    ...overrides,
  };
}

/** 1 wick of a R$ 21,00 pack of 100: R$ 0,21. Stock 64 allows 64. */
export function pavioLine(overrides: Partial<BomItemDto> = {}): BomItemDto {
  return {
    materialId: 'mat-pavio',
    materialName: 'Pavio encerado',
    quantity: 1,
    consumptionUnit: 'UNIT',
    consumptionUnitSymbol: 'un',
    unitCost: dec('0.2100'),
    lineCost: dec('0.21'),
    stockQuantity: 64,
    possibleUnits: 64,
    ...overrides,
  };
}

export const velaBaunilha = compositeProductDto();

/**
 * A product the stock cannot make: 700 g of cera against 680 g on the shelf.
 * It has a manual price, and a margin that is not a round number.
 *
 * 28,00 x 700 / 1000 = 19,60; plus 5,00 = 24,60; x 1,3333 = 32,7992 -> 32,80.
 */
export const kitPresente = compositeProductDto({
  id: 'prod-kit',
  name: 'Kit presente',
  fixedOperationalCost: dec('5.00'),
  profitMarginBasisPoints: 3333,
  manualPrice: dec('60.00'),
  materialsCost: dec('19.60'),
  totalCost: dec('24.60'),
  suggestedPrice: dec('32.80'),
  finalPrice: dec('60.00'),
  productionCapacity: 0,
  bottleneck: { materialId: 'mat-cera', materialName: 'Cera de soja', possibleUnits: 0 },
  billOfMaterials: [ceraLine({ quantity: 700, lineCost: dec('19.60'), possibleUnits: 0 })],
  updatedAt: '2026-10-10T10:18:00.000Z',
});

/** Out of use: it only appears when the list is asked for the discontinued ones. */
export const velaAposentada = compositeProductDto({
  id: 'prod-aposentada',
  name: 'Vela aposentada',
  isActive: false,
  discontinuedAt: '2026-09-20T15:00:00.000Z',
});

/**
 * A bill whose material was discontinued after the line was put on it. The
 * line is intact: the API still prices it and still counts its stock.
 */
export const velaComInsumoAntigo = compositeProductDto({
  id: 'prod-antigo',
  name: 'Vela com fragrância antiga',
  fixedOperationalCost: dec('0.00'),
  profitMarginBasisPoints: 0,
  materialsCost: dec('2.80'),
  totalCost: dec('2.80'),
  suggestedPrice: dec('2.80'),
  finalPrice: dec('2.80'),
  productionCapacity: 0,
  bottleneck: { materialId: 'mat-antiga', materialName: 'Fragrância antiga', possibleUnits: 0 },
  billOfMaterials: [
    ceraLine({
      materialId: 'mat-antiga',
      materialName: 'Fragrância antiga',
      quantity: 100,
      lineCost: dec('2.80'),
      stockQuantity: 0,
      possibleUnits: 0,
    }),
  ],
});

interface HandlerOptions {
  products?: CompositeProductDto[];
  onRequest?: (url: URL) => void;
}

/**
 * The default answers of the read routes of `/composite-products`, for a
 * screen test that does not care about most of them. A test about a mutation
 * adds its own handler in front of these.
 */
export function compositeProductsHandlers(options: HandlerOptions = {}) {
  const { products = [velaBaunilha, kitPresente], onRequest } = options;

  return [
    http.get(`${API}/composite-products`, ({ request }) => {
      const url = new URL(request.url);
      onRequest?.(url);

      const withDiscontinued = url.searchParams.get('includeDiscontinued') === 'true';

      return HttpResponse.json(products.filter((product) => withDiscontinued || product.isActive));
    }),
    http.get(`${API}/composite-products/:id`, ({ params }) => {
      const found = products.find((product) => product.id === params.id);

      return found === undefined
        ? HttpResponse.json(apiErrorBody(422, 'COMPOSITE_PRODUCT_NOT_FOUND'), { status: 422 })
        : HttpResponse.json(found);
    }),
  ];
}

/**
 * Makes `dto` the API's version of the product it names, and hands it back to
 * answer with. A mutation handler uses it so that what a `PATCH` answers is
 * also what the next `GET` answers, which is how the real thing behaves and
 * what makes the refetch after saving honest.
 */
export function keepProduct(state: CompositeProductDto[], dto: CompositeProductDto) {
  const index = state.findIndex((product) => product.id === dto.id);

  if (index === -1) {
    state.push(dto);
  } else {
    state[index] = dto;
  }

  return dto;
}
