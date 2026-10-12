/**
 * The rounding policy as a contract, ported from the backend.
 *
 * Sources, and they are the source of truth:
 *
 * - `craft-stock-api/docs/api-contract.md` section 7.2 — the 15 `scaled`
 *   vectors and the 6 decimal-string readings;
 * - `craft-stock-api/src/shared/domain/money/money.spec.ts` — the same
 *   vectors, as the backend runs them;
 * - `craft-stock-api/src/shared/domain/money/fractional-amount.spec.ts` — the
 *   four-place display figures;
 * - `craft-stock-api/src/shared/domain/money/margin.spec.ts` — the margin
 *   cases.
 *
 * Every expected value here is copied, not computed. A case that stops
 * matching is a divergence of arithmetic between the two sides of the system,
 * never a number to adjust: a preview a cent away from the saved value is a
 * defect in the price, and this file is what catches it before anyone sells at
 * it.
 *
 * One difference in how they are read, and it is deliberate. The backend's
 * `Money` holds whole cents, so its `scaled` rounds to the cent; this one
 * holds four places (see `MONEY_SCALE`) so that `"0.0280"` per gram survives
 * being parsed. The cent is therefore an explicit step here —
 * `Money.scaledToCents` and `Money.roundToCents` — and that is the operation
 * these vectors exercise. The expected values are untouched.
 */

/** `amount x multiplier / divisor`, rounded once to the cent. */
export interface ScaledVector {
  amount: string;
  multiplier: number;
  divisor: number;
  result: string;
  note: string;
}

/** api-contract.md section 7.2, and `money.spec.ts` `vectors.scaled`. */
export const SCALED_VECTORS: readonly ScaledVector[] = [
  {
    amount: '0.25',
    multiplier: 1.14,
    divisor: 1,
    result: '0.29',
    note: '28,5 cents; a float computes 28.499999999999996 and rounds down',
  },
  {
    amount: '0.25',
    multiplier: 0.58,
    divisor: 1,
    result: '0.15',
    note: '14,5 cents; a float computes 14.499999999999998',
  },
  { amount: '0.01', multiplier: 12.5, divisor: 1, result: '0.13', note: '0,125' },
  { amount: '0.01', multiplier: 13.5, divisor: 1, result: '0.14', note: '0,135' },
  {
    amount: '-0.01',
    multiplier: 12.5,
    divisor: 1,
    result: '-0.13',
    note: '-0,125 rounds away from zero',
  },
  { amount: '1.00', multiplier: 1, divisor: 8, result: '0.13', note: '0,125' },
  { amount: '1.00', multiplier: 1, divisor: 3, result: '0.33', note: '' },
  { amount: '1.00', multiplier: 2, divisor: 3, result: '0.67', note: '' },
  {
    amount: '28.00',
    multiplier: 120,
    divisor: 1000,
    result: '3.36',
    note: '120 g of a 1 kg bag',
  },
  { amount: '5.00', multiplier: 1, divisor: 1000, result: '0.01', note: 'half a cent' },
  { amount: '5.00', multiplier: 3, divisor: 1000, result: '0.02', note: 'one and a half cents' },
  { amount: '-5.00', multiplier: 3, divisor: 1000, result: '-0.02', note: '' },
  { amount: '0.05', multiplier: 0.5, divisor: 1, result: '0.03', note: '2,5 cents' },
  { amount: '0.05', multiplier: -0.5, divisor: 1, result: '-0.03', note: '' },
  { amount: '59.90', multiplier: 0.146, divisor: 1, result: '8.75', note: '8,7454, no tie' },
];

/**
 * api-contract.md section 7.2, "Leitura de string decimal (arredonda na
 * terceira casa)". The backend rounds to the cent as it parses, because that
 * is all its `Money` can hold; this one parses the string exactly and rounds
 * to the cent when a cent is what is being read, which is the same policy
 * applied at the same place.
 */
export const PARSE_VECTORS: readonly { input: string; cents: string }[] = [
  { input: '0.125', cents: '0.13' },
  { input: '0.135', cents: '0.14' },
  { input: '0.124', cents: '0.12' },
  { input: '-0.125', cents: '-0.13' },
  { input: '10.005', cents: '10.01' },
  { input: '-10.005', cents: '-10.01' },
];

/**
 * `fractional-amount.spec.ts`: the four-place display figure, which on this
 * side is the amount the API already sends with four places, read back out.
 * `amount / divisor` at four places, rounded by the one policy.
 */
export const FRACTIONAL_AMOUNT_VECTORS: readonly {
  amount: string;
  divisor: number;
  result: string;
  note: string;
}[] = [
  {
    amount: '28.00',
    divisor: 1000,
    result: '0.0280',
    note: 'a gram of flour: whole cents would hold 0.03',
  },
  { amount: '19.90', divisor: 1, result: '19.9000', note: 'four places above a cent too' },
  { amount: '10.00', divisor: 3, result: '3.3333', note: 'rounded, not truncated' },
  { amount: '20.00', divisor: 3, result: '6.6667', note: 'rounded, not truncated' },
  { amount: '0.01', divisor: 8, result: '0.0013', note: 'a tie in the fourth place rises' },
  { amount: '-0.01', divisor: 8, result: '-0.0013', note: 'and away from zero when negative' },
  { amount: '0.05', divisor: 40, result: '0.0013', note: 'every route to the same fraction' },
  { amount: '-0.05', divisor: 40, result: '-0.0013', note: '' },
  { amount: '-28.00', divisor: 1000, result: '-0.0280', note: 'sign in front of the amount' },
  { amount: '0.00', divisor: 1000, result: '0.0000', note: 'zero' },
];

/** `margin.spec.ts`, and pricing-formula.md section 1. */
export const MARGIN_VECTORS: readonly {
  amount: string;
  basisPoints: number;
  result: string;
  note: string;
}[] = [
  { amount: '10.00', basisPoints: 0, result: '10.00', note: 'no margin sells at cost' },
  { amount: '10.00', basisPoints: 10_000, result: '20.00', note: '100% doubles the amount' },
  {
    amount: '10.01',
    basisPoints: 3333,
    result: '13.35',
    note: '1334,6333 cents; 33,33% is no float',
  },
  {
    amount: '1.25',
    basisPoints: 3480,
    result: '1.69',
    note: 'exactly 168,5 cents; a float gives 168,49999...',
  },
  {
    amount: '-1.25',
    basisPoints: 3480,
    result: '-1.69',
    note: 'and away from zero when negative',
  },
];
