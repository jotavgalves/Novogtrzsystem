import { failDatabaseOperation } from './database-error';

export function requireOperationReason(reason: string): string {
  const normalized = reason.trim();

  if (normalized.length < 3) {
    failDatabaseOperation(
      'VALIDATION_ERROR',
      'Informe uma justificativa com pelo menos 3 caracteres.',
      { field: 'reason', minimumLength: 3 },
    );
  }

  if (normalized.length > 240) {
    failDatabaseOperation(
      'VALIDATION_ERROR',
      'A justificativa deve ter no máximo 240 caracteres.',
      { field: 'reason', maximumLength: 240 },
    );
  }

  return normalized;
}
