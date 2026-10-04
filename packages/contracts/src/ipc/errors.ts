// LLD §17 — error taxonomy. Integrity errors fail loudly; hardware/transport errors never block a sale.
export type ErrorClass =
  | 'validation' | 'permission' | 'business_rule' | 'conflict'
  | 'hardware' | 'transient' | 'permanent' | 'integrity' | 'auth';

export const ERROR_CODES = {
  VALIDATION_FAILED: 'validation',
  PERMISSION_DENIED: 'permission',
  NOT_AUTHENTICATED: 'auth',
  SESSION_EXPIRED: 'auth',
  INVALID_CREDENTIALS: 'auth',
  OFFLINE_PERIOD_EXCEEDED: 'auth',
  PIN_LOCKED: 'auth',
  DEVICE_REVOKED: 'auth',
  DEVICE_CLOCK_SKEW: 'auth',
  RATE_LIMITED: 'transient',
  NOT_FOUND: 'business_rule',
  ALREADY_EXISTS: 'business_rule',
  INVALID_STATE: 'business_rule',
  REGISTER_NOT_OPEN: 'business_rule',
  STOCK_INSUFFICIENT: 'business_rule',
  CREDIT_LIMIT_EXCEEDED: 'business_rule',
  PERIOD_LOCKED: 'business_rule',
  RETURN_QTY_EXCEEDED: 'business_rule',
  LEDGER_IMBALANCE: 'integrity',
  STOCK_PROJECTION_DRIFT: 'integrity',
  AUDIT_CHAIN_BROKEN: 'integrity',
  DB_CORRUPT: 'integrity',
  SECRET_STORE_UNAVAILABLE: 'integrity',
  BACKUP_INVALID: 'integrity',
  PRINTER_OFFLINE: 'hardware',
  DRAWER_FAILED: 'hardware',
  SCALE_UNSTABLE: 'hardware',
  NETWORK_UNREACHABLE: 'transient',
  DISK_FULL: 'transient',
  SERVER_BUSY: 'transient',
  DEPENDENCY_MISSING: 'transient',
  TOTAL_MISMATCH: 'permanent',
  SCHEMA_REJECTED: 'permanent',
  UPGRADE_REQUIRED: 'permanent',
  INTERNAL: 'permanent',
} as const satisfies Record<string, ErrorClass>;

export type ErrorCode = keyof typeof ERROR_CODES;

/** The only error shape that crosses the IPC bridge. No stack, no SQL text. */
export interface ClientError {
  code: ErrorCode;
  class: ErrorClass;
  message: string;
  /** field-level messages for VALIDATION_FAILED */
  fields?: Record<string, string>;
  /** correlation id for support bundles */
  requestId?: string;
}

export type IpcEnvelope<T> = { ok: true; data: T } | { ok: false; error: ClientError };

export class AppError extends Error {
  readonly class: ErrorClass;
  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message ?? code);
    this.name = 'AppError';
    this.class = ERROR_CODES[code];
  }
}
