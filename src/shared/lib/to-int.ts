/**
 * Reads an integer out of a route parameter or a query string.
 *
 * It exists so that `parseInt` and `Number()` can be forbidden everywhere
 * else: the two of them answer `NaN`, `Infinity` and `12` to `"12abc"`
 * depending on which one is reached for, and a page number that silently
 * became `NaN` renders an empty list that looks like an empty list.
 *
 * Returns `null` for anything that is not a plain, safe integer, so the caller
 * has to decide what a missing or malformed value means. It is deliberately
 * not for money or quantities — those are `Money` and `Quantity`, which never
 * become a `number` at all.
 */
const INTEGER_PATTERN = /^[+-]?\d+$/;

export function toInt(value: string | undefined | null): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();

  if (!INTEGER_PATTERN.test(trimmed)) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);

  return Number.isSafeInteger(parsed) ? parsed : null;
}

/** The same, with a value to fall back to when the parameter is absent or unreadable. */
export function toIntOr(value: string | undefined | null, fallback: number): number {
  return toInt(value) ?? fallback;
}
