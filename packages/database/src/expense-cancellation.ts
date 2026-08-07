import { randomUUID } from 'node:crypto';

import { appendAudit } from './audit';
import {
  getExpenseWithPayments,
  requireExpenseEvent,
  requireExpenseProduction,
  type DatabaseExpense,
  type DatabaseExpenseStatus,
} from './expense-repository';
import { requireOperationReason } from './operation-validation';
import type { DatabasePaymentMethod } from './operation-types';
import type { DatabaseContext } from './types';

export interface DatabaseExpenseCancelPreview {
  readonly expenseId: string;
  readonly category: string;
  readonly description: string;
  readonly status: 'open' | 'partial' | 'paid';
  readonly totalCents: number;
  readonly paidCents: number;
  readonly pendingCents: number;
  readonly activePaymentCount: number;
  readonly refundTotalCents: number;
  readonly refundCashCents: number;
  readonly refundDigitalCents: number;
  readonly activePayments: readonly {
    readonly id: string;
    readonly paymentMethod: DatabasePaymentMethod;
    readonly amountCents: number;
    readonly note: string | null;
  }[];
}

export function refundExpensePayment(
  database: DatabaseContext,
  input: { readonly paymentId: string; readonly reason: string },
): DatabaseExpense {
  requireExpenseProduction(database);
  const eventId = requireExpenseEvent(database);
  const payment = database.sqlite
    .prepare(
      `SELECT id, event_id, expense_id, payment_method, amount_cents, note, status
       FROM expense_payments
       WHERE id = ?`,
    )
    .get(input.paymentId) as
    | {
        readonly id: string;
        readonly event_id: string;
        readonly expense_id: string;
        readonly payment_method: DatabasePaymentMethod;
        readonly amount_cents: number;
        readonly note: string | null;
        readonly status: 'active' | 'refunded';
      }
    | undefined;

  if (payment === undefined) {
    throw new Error('O pagamento da despesa informado não existe.');
  }

  if (payment.event_id !== eventId) {
    throw new Error('O pagamento da despesa não pertence ao evento ativo.');
  }

  if (payment.status === 'refunded') {
    throw new Error('Este pagamento de despesa já foi estornado.');
  }

  const expense = getExpenseWithPayments(database, payment.expense_id);

  if (expense.status === 'cancelled') {
    throw new Error('Despesa cancelada não pode ter parcela estornada isoladamente.');
  }

  const reason = requireOperationReason(input.reason);
  const now = Date.now();
  const correlationId = randomUUID();
  const nextPaidCents = expense.paidCents - payment.amount_cents;
  const nextPendingCents = expense.totalCents - nextPaidCents;
  const nextStatus: DatabaseExpenseStatus = nextPaidCents === 0 ? 'open' : 'partial';

  database.sqlite.transaction(() => {
    database.sqlite
      .prepare(
        `UPDATE expense_payments
         SET status = 'refunded', refunded_at = ?
         WHERE id = ?`,
      )
      .run(now, payment.id);
    database.sqlite.prepare('UPDATE expenses SET updated_at = ? WHERE id = ?').run(now, expense.id);
    appendAudit(database, {
      action: 'expense.payment-refunded',
      entityType: 'expense-payment',
      entityId: payment.id,
      eventId,
      correlationId,
      before: { status: payment.status },
      after: { status: 'refunded', refundedAt: now },
      impact: { amountCents: payment.amount_cents, paymentMethod: payment.payment_method },
      details: { expenseId: expense.id, reason },
    });
    appendAudit(database, {
      action: 'expense.recalculated-after-refund',
      entityType: 'expense',
      entityId: expense.id,
      eventId,
      correlationId,
      before: {
        paidCents: expense.paidCents,
        pendingCents: expense.pendingCents,
        status: expense.status,
      },
      after: { paidCents: nextPaidCents, pendingCents: nextPendingCents, status: nextStatus },
      impact: { refundedCents: payment.amount_cents },
    });
  })();

  return getExpenseWithPayments(database, expense.id);
}

export function previewCancelExpense(
  database: DatabaseContext,
  input: { readonly expenseId: string },
): DatabaseExpenseCancelPreview {
  requireExpenseProduction(database);
  const eventId = requireExpenseEvent(database);
  const expense = getExpenseWithPayments(database, input.expenseId);

  if (expense.eventId !== eventId) {
    throw new Error('A despesa não pertence ao evento ativo.');
  }

  if (expense.status === 'cancelled') {
    throw new Error('Esta despesa já foi cancelada.');
  }

  const activePayments = expense.payments
    .filter((payment) => payment.status === 'active')
    .map((payment) => ({
      id: payment.id,
      paymentMethod: payment.paymentMethod,
      amountCents: payment.amountCents,
      note: payment.note,
    }));
  const refundCashCents = activePayments
    .filter((payment) => payment.paymentMethod === 'cash')
    .reduce((total, payment) => total + payment.amountCents, 0);
  const refundTotalCents = activePayments.reduce(
    (total, payment) => total + payment.amountCents,
    0,
  );

  return {
    expenseId: expense.id,
    category: expense.category,
    description: expense.description,
    status: expense.status,
    totalCents: expense.totalCents,
    paidCents: expense.paidCents,
    pendingCents: expense.pendingCents,
    activePaymentCount: activePayments.length,
    refundTotalCents,
    refundCashCents,
    refundDigitalCents: refundTotalCents - refundCashCents,
    activePayments,
  };
}

export function cancelExpense(
  database: DatabaseContext,
  input: { readonly expenseId: string; readonly reason: string },
): DatabaseExpense {
  const preview = previewCancelExpense(database, input);
  const expense = getExpenseWithPayments(database, preview.expenseId);
  const reason = requireOperationReason(input.reason);
  const eventId = requireExpenseEvent(database);
  const correlationId = randomUUID();
  const now = Date.now();

  database.sqlite.transaction(() => {
    const refundPayment = database.sqlite.prepare(
      `UPDATE expense_payments
       SET status = 'refunded', refunded_at = ?
       WHERE id = ? AND status = 'active'`,
    );

    for (const payment of preview.activePayments) {
      refundPayment.run(now, payment.id);
      appendAudit(database, {
        action: 'expense.payment-refunded-by-cancellation',
        entityType: 'expense-payment',
        entityId: payment.id,
        eventId,
        correlationId,
        before: { status: 'active' },
        after: { status: 'refunded', refundedAt: now },
        impact: { amountCents: payment.amountCents, paymentMethod: payment.paymentMethod },
        details: { expenseId: expense.id, reason },
      });
    }

    database.sqlite
      .prepare(
        `UPDATE expenses
         SET status = 'cancelled', cancelled_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(now, now, expense.id);
    appendAudit(database, {
      action: 'expense.cancelled',
      entityType: 'expense',
      entityId: expense.id,
      eventId,
      correlationId,
      before: {
        category: expense.category,
        description: expense.description,
        note: expense.note,
        paidCents: expense.paidCents,
        pendingCents: expense.pendingCents,
        status: expense.status,
        totalCents: expense.totalCents,
      },
      after: {
        paidCents: 0,
        pendingCents: 0,
        status: 'cancelled',
        totalCents: expense.totalCents,
      },
      impact: preview,
      details: { reason },
    });
  })();

  return getExpenseWithPayments(database, expense.id);
}
