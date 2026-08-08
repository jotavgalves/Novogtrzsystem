import type { CloseOrderInput, Order, PaymentMethod } from '@gtrz/contracts';
import { parseCurrencyInput } from '@gtrz/domain';

export interface PaymentDraft {
  readonly id: string;
  readonly method: PaymentMethod;
  readonly amount: string;
  readonly received: string;
}

export type CheckoutMode = 'single' | 'mixed';

interface CheckoutValidationInput {
  readonly order: Order;
  readonly discount: string;
  readonly payments: readonly PaymentDraft[];
  readonly voucherAmount: string;
  readonly busy: boolean;
  readonly mode: CheckoutMode;
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
  const voucherInvalid =
    voucherCents > 0 &&
    (allocation?.status !== 'active' ||
      voucherCents > allocation.remainingBalanceCents ||
      voucherCents > totalCents);
  const amountAfterVoucherCents = Math.max(totalCents - voucherCents, 0);
  const cashDrafts = input.payments.filter((payment) => payment.method === 'cash');
  const paymentConfigurationInvalid =
    input.mode === 'single' ? input.payments.length !== 1 : cashDrafts.length > 1;

  const normalizedPayments: Omit<CloseOrderInput, 'orderId'>['payments'] = [];
  let paymentCents = 0;
  let cashAppliedCents = 0;
  let cashReceivedCents = 0;
  let cashReceivedWasEntered = false;

  if (!paymentConfigurationInvalid && input.mode === 'single') {
    const payment = input.payments[0];

    if (payment !== undefined && amountAfterVoucherCents > 0) {
      if (payment.method === 'cash') {
        cashAppliedCents = amountAfterVoucherCents;
        cashReceivedCents = parseCurrencyInput(payment.received);
        cashReceivedWasEntered = cashReceivedCents > 0;
        normalizedPayments.push(
          cashReceivedWasEntered
            ? {
                method: 'cash',
                amountCents: cashAppliedCents,
                receivedCents: cashReceivedCents,
              }
            : { method: 'cash', amountCents: cashAppliedCents },
        );
      } else {
        normalizedPayments.push({
          method: payment.method,
          amountCents: amountAfterVoucherCents,
        });
      }

      paymentCents = amountAfterVoucherCents;
    }
  }

  if (!paymentConfigurationInvalid && input.mode === 'mixed') {
    for (const payment of input.payments) {
      const amountCents = parseCurrencyInput(payment.amount);

      if (amountCents <= 0) {
        continue;
      }

      if (payment.method === 'cash') {
        cashAppliedCents = amountCents;
        cashReceivedCents = parseCurrencyInput(payment.received);
        cashReceivedWasEntered = cashReceivedCents > 0;
        normalizedPayments.push(
          cashReceivedWasEntered
            ? { method: 'cash', amountCents, receivedCents: cashReceivedCents }
            : { method: 'cash', amountCents },
        );
      } else {
        normalizedPayments.push({ method: payment.method, amountCents });
      }

      paymentCents += amountCents;
    }
  }

  const informedCents = paymentCents + voucherCents;
  const remainingCents = Math.max(totalCents - informedCents, 0);
  const overpaidCents = Math.max(informedCents - totalCents, 0);
  const cashInvalid =
    cashAppliedCents > 0 && cashReceivedWasEntered && cashReceivedCents < cashAppliedCents;
  const totalChangeCents =
    cashAppliedCents > 0 && cashReceivedWasEntered
      ? Math.max(cashReceivedCents - cashAppliedCents, 0)
      : 0;
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
    remainingCents === 0 &&
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
