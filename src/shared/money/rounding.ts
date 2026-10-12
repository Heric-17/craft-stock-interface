import { InvalidMoneyOperationError } from './money.error';

/**
 * The single rounding function of the frontend: **half away from zero**,
 * applied once, to the exact result.
 *
 * Ported from `divideRoundingHalfAwayFromZero` in the backend's
 * `src/shared/domain/money/money.ts`, and it has to stay identical to it. The
 * API calculates every derived amount this way and the screen reproduces a few
 * of them (the suggested price while a `BillOfMaterials` is still being
 * edited); a different mode there puts a preview a cent away from the value
 * that comes back after saving, which reads as a defect in the price and
 * cannot be explained to whoever is selling.
 *
 * `0.125` becomes `0.13`, `-0.125` becomes `-0.13`, `0.124` becomes `0.12`.
 * The arithmetic is `floor((2·|n| + |d|) ÷ 2·|d|)` with the sign restored at
 * the end, in `bigint`: a tie is decided by the rule and never by how a
 * `number` happens to represent it. In floating point `0.25 × 1.14` is
 * `0.28499999999999996` and would round down, while the exact value, `0.285`,
 * rounds up.
 */
export function divideRoundingHalfAwayFromZero(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new InvalidMoneyOperationError('Cannot divide by zero.');
  }

  const negative = numerator < 0n !== denominator < 0n;
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  const quotient = (2n * absoluteNumerator + absoluteDenominator) / (2n * absoluteDenominator);

  return negative ? -quotient : quotient;
}

/** `10 ** exponent` as a `bigint`, for shifting a decimal point. */
export function powerOfTen(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}
