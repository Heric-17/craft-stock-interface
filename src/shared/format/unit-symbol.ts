import { type ConsumptionUnit } from '@/shared/quantity';

/**
 * What each unit is called on screen, and the only place the abbreviations
 * live.
 *
 * Two sets, because a quantity is read in whichever unit makes it legible:
 * 680 grams is `680 g` and 1440 grams is `1,44 kg`. `UNIT` has one reading,
 * `un`, at every size.
 */
const BASE_UNIT_SYMBOLS: Record<ConsumptionUnit, string> = {
  UNIT: 'un',
  GRAM: 'g',
  MILLILITER: 'ml',
  CENTIMETER: 'cm',
};

const MAJOR_UNIT_SYMBOLS: Record<ConsumptionUnit, string> = {
  UNIT: 'un',
  GRAM: 'kg',
  MILLILITER: 'L',
  CENTIMETER: 'm',
};

export function baseUnitSymbol(unit: ConsumptionUnit): string {
  return BASE_UNIT_SYMBOLS[unit];
}

export function majorUnitSymbol(unit: ConsumptionUnit): string {
  return MAJOR_UNIT_SYMBOLS[unit];
}
