import { describe, expect, it } from 'vitest';

import { ipcResponseSchema } from './errors';

describe('IPC error envelope round-trip', () => {
  it('preserva código e dados estruturados após serialização', () => {
    const original = {
      ok: false as const,
      error: {
        code: 'INSUFFICIENT_BALANCE' as const,
        message: 'Saldo insuficiente no voucher.',
        details: {
          voucherId: 'voucher-1',
          requestedCents: 300,
          availableCents: 200,
        },
      },
    };
    const transported: unknown = JSON.parse(JSON.stringify(original));

    expect(ipcResponseSchema.parse(transported)).toEqual(original);
  });
});
