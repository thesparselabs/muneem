/** Thrown by domain engines on invalid input. Never thrown for arithmetic that succeeded. */
export class DomainError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_INPUT'
      | 'OVERFLOW'
      | 'DISCOUNT_EXCEEDS_VALUE'
      | 'DIVIDE_BY_ZERO'
      | 'LEDGER_IMBALANCE',
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
