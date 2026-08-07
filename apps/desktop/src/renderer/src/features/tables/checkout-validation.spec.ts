import { describe, expect, it } from 'vitest';

import type { Order } from '@gtrz/contracts';

import { validateCheckout, type PaymentDraft } from './checkout-validation';

const baseOrder: Order = {
  id: '00000000-0000-4000-8000-000000000001',
  eventId: '00000000-0000-4000-8000-000000000002',
  servicePointId: '00000000-0000-4000-8000-000000000003',
  servicePointLabel: 'Mesa 1',
  status: 'open',
  subtotalCents: 1_000,
  discountCents: 0,
  totalCents: 0,
  paidCents: 0,
  remainingCents: 0,
  items: [
    {
      id: '00000000-0000-4000-8000-000000000004',
      orderId: '00000000-0000-4000-8000-000000000001',
      itemKind: 'product',
      itemId: '00000000-0000-4000-8000-000000000005',
      itemName: 'Água',
      quantity: 1,
      unitPriceCents: 1_000,
      totalCents: 1_000,
      createdAt: 1,
    },
  ],
  payments: [],
  voucherAllocation: null,
  voucherRedemptions: [],
  openedAt: 1,
  closedAt: null,
  updatedAt: 1,
};

function payment(patch: Partial<PaymentDraft> = {}): PaymentDraft {
  return {
    id: 'payment-1',
    method: 'cash',
    amount: '10,00',
    received: '',
    ...patch,
  };
}

describe('validateCheckout', () => {
  it('normaliza pagamentos e libera fechamento quando a soma fecha o total', () => {
    const result = validateCheckout({
      busy: false,
      discount: '',
      order: baseOrder,
      payments: [payment({ received: '20,00' })],
      voucherAmount: '',
    });

    expect(result).toMatchObject({
      canSubmit: true,
      informedCents: 1_000,
      remainingCents: 0,
      totalChangeCents: 1_000,
    });
    expect(result.normalizedPayments).toEqual([
      { method: 'cash', amountCents: 1_000, receivedCents: 2_000 },
    ]);
  });

  it('bloqueia dinheiro insuficiente, excesso informado e voucher acima do saldo', () => {
    expect(
      validateCheckout({
        busy: false,
        discount: '',
        order: baseOrder,
        payments: [payment({ received: '5,00' })],
        voucherAmount: '',
      }),
    ).toMatchObject({ canSubmit: false, cashInvalid: true });

    expect(
      validateCheckout({
        busy: false,
        discount: '',
        order: baseOrder,
        payments: [payment({ amount: '11,00' })],
        voucherAmount: '',
      }),
    ).toMatchObject({ canSubmit: false, overpaidCents: 100 });

    expect(
      validateCheckout({
        busy: false,
        discount: '',
        order: {
          ...baseOrder,
          voucherAllocation: {
            voucherId: '00000000-0000-4000-8000-000000000006',
            code: 'VCH-01',
            label: 'Voucher',
            remainingBalanceCents: 500,
            status: 'active',
            createdAt: 1,
            updatedAt: 1,
          },
        },
        payments: [payment({ amount: '5,00' })],
        voucherAmount: '6,00',
      }),
    ).toMatchObject({ canSubmit: false, voucherInvalid: true });
  });
});
