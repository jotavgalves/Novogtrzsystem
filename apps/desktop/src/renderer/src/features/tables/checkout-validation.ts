import type { CloseOrderInput, Order, PaymentMethod } from '@gtrz/contracts';
import { parseCurrencyInput } from '@gtrz/domain';

export interface PaymentDraft {
  readonly id: string;
  readonly method: PaymentMethod;
  readonly amount: string;
  readonly received: string;
}

interface CheckoutValidationInput {
  readonly order: Order;
  readonly discount: string;
  readonly payments: readonly PaymentDraft[];
  readonly voucherAmount: string;
  readonly busy: boolean;
}

interface CheckoutValidationResult {
  readonly canSubmit: boolean;
  readonly discountCents: number;
  readonly discountInvalid: boolean;
  readonly totalCents: number;
  readonly paymentCents: number;
  readonly voucherCents: number;
  readonly informedCents: number;
  readonly remainingCents: number;
  readonly overpaidCents: number;
  readonly totalChangeCents: number;
  readonly cashInvalid: boolean;
  readonly voucherInvalid: boolean;
  readonly normalizedPayments: Omit<CloseOrderInput, 'orderId'>['payments'];
  readonly voucherUses: Omit<CloseOrderInput, 'orderId'>['voucherUses'];
}

export function validateCheckout(input: CheckoutValidationInput): CheckoutValidationResult {
  const discountCents = parseCurrencyInput(input.discount);
  const discountInvalid = discountCents > input.order.subtotalCents;
  const totalCents = Math.max(input.order.subtotalCents - discountCents, 0);
  const allocation = input.order.voucherAllocation;
  const voucherCents = parseCurrencyInput(input.voucherAmount);
  const normalizedPayments = input.payments
    .map((payment) => {
      const amountCents = parseCurrencyInput(payment.amount);
      const receivedCents = parseCurrencyInput(payment.received);
      return payment.method === 'cash' && receivedCents > 0
        ? { method: payment.method, amountCents, receivedCents }
        : { method: payment.method, amountCents };
    })
    .filter((payment) => payment.amountCents > 0);
  const paymentCents = normalizedPayments.reduce(
    (total, payment) => total + payment.amountCents,
    0,
  );
  const informedCents = paymentCents + voucherCents;
  const remainingCents = Math.max(totalCents - informedCents, 0);
  const overpaidCents = Math.max(informedCents - totalCents, 0);
  const totalChangeCents = input.payments.reduce((total, payment) => {
    if (payment.method !== 'cash') {
      return total;
    }

    const amountCents = parseCurrencyInput(payment.amount);
    const receivedCents = parseCurrencyInput(payment.received);
    return total + Math.max(receivedCents - amountCents, 0);
  }, 0);
  const cashInvalid = input.payments.some((payment) => {
    if (payment.method !== 'cash') {
      return false;
    }

    const amountCents = parseCurrencyInput(payment.amount);
    const receivedCents = parseCurrencyInput(payment.received);
    return receivedCents > 0 && receivedCents < amountCents;
  });
  const voucherInvalid =
    voucherCents > 0 &&
    (allocation?.status !== 'active' ||
      voucherCents > allocation.remainingBalanceCents ||
      voucherCents > totalCents);
  const voucherUses =
    allocation !== null && voucherCents > 0
      ? [{ code: allocation.code, amountCents: voucherCents }]
      : [];
  const canSubmit =
    !input.busy &&
    input.order.items.length > 0 &&
    !discountInvalid &&
    !cashInvalid &&
    !voucherInvalid &&
    totalCents > 0 &&
    informedCents === totalCents &&
    normalizedPayments.length + voucherUses.length > 0;

  return {
    canSubmit,
    cashInvalid,
    discountCents,
    discountInvalid,
    informedCents,
    normalizedPayments,
    overpaidCents,
    paymentCents,
    remainingCents,
    totalCents,
    totalChangeCents,
    voucherCents,
    voucherInvalid,
    voucherUses,
  };
}
