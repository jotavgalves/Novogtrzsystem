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
  readonly cashAppliedCents: number;
  readonly cashInvalid: boolean;
  readonly paymentConfigurationInvalid: boolean;
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
  const cashDrafts = input.payments.filter((payment) => payment.method === 'cash');
  const digitalPayments = input.payments
    .filter((payment) => payment.method !== 'cash')
    .map((payment) => ({
      method: payment.method,
      amountCents: parseCurrencyInput(payment.amount),
    }))
    .filter((payment) => payment.amountCents > 0);
  const digitalPaymentCents = digitalPayments.reduce(
    (total, payment) => total + payment.amountCents,
    0,
  );
  const amountBeforeCashCents = digitalPaymentCents + voucherCents;
  const overpaidCents = Math.max(amountBeforeCashCents - totalCents, 0);
  const cashAppliedCents =
    cashDrafts.length === 1 && overpaidCents === 0
      ? Math.max(totalCents - amountBeforeCashCents, 0)
      : 0;
  const cashReceivedCents = parseCurrencyInput(cashDrafts[0]?.received ?? '');
  const cashPayment =
    cashDrafts.length === 1 && cashAppliedCents > 0
      ? [
          cashReceivedCents > 0
            ? {
                method: 'cash' as const,
                amountCents: cashAppliedCents,
                receivedCents: cashReceivedCents,
              }
            : { method: 'cash' as const, amountCents: cashAppliedCents },
        ]
      : [];
  const normalizedPayments = [...digitalPayments, ...cashPayment];
  const paymentCents = digitalPaymentCents + cashAppliedCents;
  const informedCents = paymentCents + voucherCents;
  const remainingCents = Math.max(totalCents - informedCents, 0);
  const totalChangeCents =
    cashAppliedCents > 0 ? Math.max(cashReceivedCents - cashAppliedCents, 0) : 0;
  const paymentConfigurationInvalid = cashDrafts.length > 1;
  const cashInvalid =
    cashAppliedCents > 0 && (cashReceivedCents <= 0 || cashReceivedCents < cashAppliedCents);
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
    !paymentConfigurationInvalid &&
    !voucherInvalid &&
    overpaidCents === 0 &&
    totalCents > 0 &&
    informedCents === totalCents &&
    normalizedPayments.length + voucherUses.length > 0;

  return {
    canSubmit,
    cashAppliedCents,
    cashInvalid,
    discountCents,
    discountInvalid,
    informedCents,
    normalizedPayments,
    overpaidCents,
    paymentCents,
    paymentConfigurationInvalid,
    remainingCents,
    totalCents,
    totalChangeCents,
    voucherCents,
    voucherInvalid,
    voucherUses,
  };
}
