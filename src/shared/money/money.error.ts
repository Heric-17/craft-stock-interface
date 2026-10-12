/**
 * Something was asked of `Money`, `Percentage` or `Quantity` that cannot be
 * answered exactly: a malformed decimal string, a `number` where a decimal
 * string belongs, a divisor of zero.
 *
 * It is thrown rather than returned as `null` because every one of those is a
 * defect — a response that does not follow the contract, or a call that broke
 * the rule the value objects exist to keep — and a silent zero in its place
 * would show a wrong amount on screen instead. User input is a different
 * matter and never reaches here: the parsers in `shared/format` answer `null`
 * for text a person typed.
 */
export class InvalidMoneyOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMoneyOperationError';
  }
}

/** The same, for `Quantity`. */
export class InvalidQuantityOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidQuantityOperationError';
  }
}
