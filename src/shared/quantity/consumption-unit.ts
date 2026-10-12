/**
 * How much of a `Material` a `BomItem` consumes is measured in, and the same
 * four values the API sends. The names are the backend's, unchanged.
 *
 * A `Material` is bought in a closed package and consumed in a fraction of it:
 * a 1 kg bag of flour is a `packageQuantity` of `1000` in `GRAM`, and a recipe
 * takes `120` of them.
 */
export const CONSUMPTION_UNITS = ['UNIT', 'GRAM', 'MILLILITER', 'CENTIMETER'] as const;

export type ConsumptionUnit = (typeof CONSUMPTION_UNITS)[number];

export function isConsumptionUnit(value: unknown): value is ConsumptionUnit {
  return typeof value === 'string' && CONSUMPTION_UNITS.includes(value as ConsumptionUnit);
}

/**
 * How many base units make the larger unit a person reads and types: a kilo is
 * 1000 grams, a litre 1000 millilitres, a metre 100 centimetres. `UNIT` has no
 * larger unit, so its factor is 1.
 *
 * The larger unit exists **only in the interface** — the API only ever carries
 * the base unit. Someone types "1,5 kg" and `1500` in `GRAM` is what travels.
 */
const MAJOR_UNIT_FACTORS: Record<ConsumptionUnit, number> = {
  UNIT: 1,
  GRAM: 1000,
  MILLILITER: 1000,
  CENTIMETER: 100,
};

export function majorUnitFactor(unit: ConsumptionUnit): number {
  return MAJOR_UNIT_FACTORS[unit];
}

/** Whether the unit has a larger unit at all. `UNIT` does not. */
export function hasMajorUnit(unit: ConsumptionUnit): boolean {
  return MAJOR_UNIT_FACTORS[unit] > 1;
}
