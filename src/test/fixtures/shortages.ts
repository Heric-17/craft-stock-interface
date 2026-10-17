import { http, HttpResponse } from 'msw';

import type {
  ShoppingListDto,
  ShoppingListLineDto,
  ShoppingListRequestDto,
} from '@/features/shortages/api/shopping-list.dto';
import { env } from '@/shared/config/env';
import { requireDecimalString } from '@/shared/money';

import { apiErrorBody, materialDto } from './materials';

const API = env.VITE_API_URL;

const dec = requireDecimalString;

export { apiErrorBody };
export type { ShoppingListDto };

/**
 * A line of the shopping list the way the backend writes one. The figures of
 * each fixture below are worked by hand from the material fixtures, not by the
 * code under test: a package is bought whole, so a line's estimate is the
 * number of packages times the package cost.
 */
export function shoppingLineDto(overrides: Partial<ShoppingListLineDto> = {}): ShoppingListLineDto {
  return {
    materialId: 'mat-cera',
    materialName: 'Cera de soja',
    needed: 2440,
    stockQuantity: 680,
    shortage: 1760,
    consumptionUnit: 'GRAM',
    consumptionUnitSymbol: 'g',
    packagesToBuy: 2,
    estimatedCost: dec('56.00'),
    estimateIssue: null,
    ...overrides,
  };
}

/** 1.760 g are missing from a 1 kg package of R$ 28,00: 2 packages, R$ 56,00. */
export const linhaCera = shoppingLineDto();

/** 14 ml are missing from a 100 ml bottle of R$ 38,00: 1 bottle, R$ 38,00. */
export const linhaEssencia = shoppingLineDto({
  materialId: 'mat-essencia',
  materialName: 'Essência baunilha',
  needed: 32,
  stockQuantity: 18,
  shortage: 14,
  consumptionUnit: 'MILLILITER',
  consumptionUnitSymbol: 'ml',
  packagesToBuy: 1,
  estimatedCost: dec('38.00'),
});

/** The stock covers it: nothing to buy, and "0.00" is the cost of buying nothing. */
export const linhaPavio = shoppingLineDto({
  materialId: 'mat-pavio',
  materialName: 'Pavio encerado',
  needed: 8,
  stockQuantity: 64,
  shortage: 0,
  consumptionUnit: 'UNIT',
  consumptionUnitSymbol: 'un',
  packagesToBuy: 0,
  estimatedCost: dec('0.00'),
});

/** The material was registered without a package: the count and the estimate are unknown, and null. */
export const linhaFita = shoppingLineDto({
  materialId: 'mat-fita',
  materialName: 'Fita de cetim',
  needed: 300,
  stockQuantity: 0,
  shortage: 300,
  consumptionUnit: 'CENTIMETER',
  consumptionUnitSymbol: 'cm',
  packagesToBuy: null,
  estimatedCost: null,
  estimateIssue: 'MISSING_PACKAGE_DATA',
});

/** The material of `linhaFita`, with no package size and no package cost. */
export const fitaSemEmbalagem = materialDto({
  id: 'mat-fita',
  name: 'Fita de cetim',
  packageCost: dec('0.00'),
  packageQuantity: 0,
  consumptionUnit: 'CENTIMETER',
  consumptionUnitSymbol: 'cm',
  stockQuantity: 0,
  stockValue: dec('0.00'),
  unitCost: dec('0.0000'),
});

/** Everything estimable: R$ 56,00 + R$ 38,00 + R$ 0,00. */
export const listaCompleta: ShoppingListDto = {
  lines: [linhaEssencia, linhaPavio, linhaCera],
  estimatedTotal: dec('94.00'),
  unestimatedLineCount: 0,
};

/** One line the API could not estimate: the total adds up the others and is a floor. */
export const listaComLinhaSemEstimativa: ShoppingListDto = {
  lines: [linhaEssencia, linhaPavio, linhaCera, linhaFita],
  estimatedTotal: dec('94.00'),
  unestimatedLineCount: 1,
};

interface ShortagesHandlerOptions {
  /** What the list answers, given the ids that were sent. */
  list?: (saleIds: string[]) => ShoppingListDto;
  /** Sees the body of every request: which sales the list was asked for. */
  onRequest?: (body: ShoppingListRequestDto) => void;
}

/**
 * The shopping-list route, which the real API answers as the API does: an empty
 * set of ids is refused with a 400, and the answer is an object, not an array.
 */
export function shortagesHandlers(options: ShortagesHandlerOptions = {}) {
  const { list = () => listaCompleta, onRequest } = options;

  return [
    http.post(`${API}/sales/shopping-list`, async ({ request }) => {
      const body = (await request.json()) as ShoppingListRequestDto;
      onRequest?.(body);

      if (!Array.isArray(body.saleIds) || body.saleIds.length === 0) {
        return HttpResponse.json(apiErrorBody(400, 'VALIDATION_FAILED'), { status: 400 });
      }

      return HttpResponse.json(list(body.saleIds));
    }),
  ];
}
