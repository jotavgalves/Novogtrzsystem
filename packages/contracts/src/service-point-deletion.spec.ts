import { describe, expect, it } from 'vitest';

import { deleteServicePointInputSchema, servicePointDeletePreviewSchema } from './operations';

describe('service point deletion contracts', () => {
  it('aceita os dois modos explícitos de exclusão de mesa', () => {
    const base = {
      servicePointId: '77777777-7777-4777-8777-777777777777',
      reason: 'Mesa retirada do mapa',
    };

    expect(deleteServicePointInputSchema.parse({ ...base, mode: 'keep-sales' }).mode).toBe(
      'keep-sales',
    );
    expect(deleteServicePointInputSchema.parse({ ...base, mode: 'refund-sales' }).mode).toBe(
      'refund-sales',
    );
  });

  it('valida a prévia financeira e operacional antes da exclusão', () => {
    expect(
      servicePointDeletePreviewSchema.parse({
        servicePointId: '77777777-7777-4777-8777-777777777777',
        label: 'Mesa 20',
        openOrders: 1,
        paidOrders: 3,
        cancelledOrders: 2,
        paidSalesCents: 4500,
        voucherConsumedCents: 1200,
        linkedVouchers: 1,
      }),
    ).toMatchObject({
      openOrders: 1,
      paidOrders: 3,
      paidSalesCents: 4500,
      voucherConsumedCents: 1200,
    });
  });

  // O protocolo torna explícita a escolha entre preservar ou estornar vendas históricas.
});
