import { describe, expect, it } from 'vitest';

import { DatabaseError, isDatabaseError } from './database-error';
import { requireOperationReason } from './operation-validation';

describe('database typed errors', () => {
  it('transporta código e dados estruturados sem depender da mensagem', () => {
    try {
      requireOperationReason('  ');
      throw new Error('A validação deveria ter falhado.');
    } catch (error: unknown) {
      expect(isDatabaseError(error)).toBe(true);
      expect(error).toBeInstanceOf(DatabaseError);

      if (!isDatabaseError(error)) {
        return;
      }

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual({ field: 'reason', minimumLength: 3 });
    }
  });

  it('preserva um motivo operacional válido', () => {
    expect(requireOperationReason('  Venda duplicada  ')).toBe('Venda duplicada');
  });
});
