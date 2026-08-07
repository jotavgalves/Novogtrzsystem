export type DatabaseErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'INVALID_STATE'
  | 'INSUFFICIENT_STOCK'
  | 'INSUFFICIENT_BALANCE'
  | 'INTEGRITY_ERROR';

export class DatabaseError extends Error {
  readonly code: DatabaseErrorCode;
  readonly details: Readonly<Record<string, unknown>> | null;

  constructor(
    code: DatabaseErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> | null = null,
  ) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.details = details;
  }
}

export function failDatabaseOperation(
  code: DatabaseErrorCode,
  message: string,
  details: Readonly<Record<string, unknown>> | null = null,
): never {
  throw new DatabaseError(code, message, details);
}

export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}
