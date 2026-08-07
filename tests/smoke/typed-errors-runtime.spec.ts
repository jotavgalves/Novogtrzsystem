import { describe, expect, it } from 'vitest';

import { appErrorPayloadSchema, ipcResponseSchema } from '../../packages/contracts/src/index';
import { failDatabaseOperation, isDatabaseError } from '../../packages/database/src/database-error';

describe('typed errors public surface', () => {
  it('mantém código e detalhes estruturados entre database e contrato IPC', () => {
    let captured: unknown;

    try {
      failDatabaseOperation('INSUFFICIENT_STOCK', 'Estoque insuficiente.', {
        productId: 'produto-1',
        requestedQuantity: 4,
        availableQuantity: 2,
      });
    } catch (error: unknown) {
      captured = error;
    }

    expect(isDatabaseError(captured)).toBe(true);

    if (!isDatabaseError(captured)) {
      throw new Error('O erro de banco deveria preservar o tipo estruturado.');
    }

    const errorPayload = appErrorPayloadSchema.parse({
      code: captured.code,
      message: captured.message,
      details: captured.details,
    });
    const response = ipcResponseSchema.parse({ ok: false, error: errorPayload });

    expect(response).toEqual({
      ok: false,
      error: {
        code: 'INSUFFICIENT_STOCK',
        message: 'Estoque insuficiente.',
        details: {
          productId: 'produto-1',
          requestedQuantity: 4,
          availableQuantity: 2,
        },
      },
    });
  });
});
