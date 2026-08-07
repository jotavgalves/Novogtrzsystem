import { randomUUID } from 'node:crypto';

import { appendAudit } from './audit';
import { getSessionState } from './control';
import {
  getExpenseWithPayments,
  insertExpensePayment,
  listExpensesForEvent,
  normalizeExpenseText,
  requireExpenseEvent,
  requireExpenseProduction,
  type DatabaseExpense,
  type DatabaseExpenseState,
  type DatabaseExpenseStatus,
} from './expense-repository';
import type { DatabasePaymentMethod } from './operation-types';
import type { DatabaseContext } from './types';

export { cancelExpense, previewCancelExpense, refundExpensePayment } from './expense-cancellation';
export type { DatabaseExpenseCancelPreview } from './expense-cancellation';
export type {
  DatabaseExpense,
  DatabaseExpensePayment,
  DatabaseExpensePaymentStatus,
  DatabaseExpenseState,
  DatabaseExpenseStatus,
} from './expense-repository';

export function getExpenseState(database: DatabaseContext): DatabaseExpenseState {
  const eventId = getSessionState(database).activeEvent?.id ?? null;

  return eventId === null
    ? { activeEventId: null, expenses: [] }
    : { activeEventId: eventId, expenses: listExpensesForEvent(database, eventId) };
}

export function createExpense(
  database: DatabaseContext,
  input: {
    readonly category: string;
    readonly description: string;
    readonly amountCents: number;
    readonly initialPaymentCents?: number;
    readonly paymentMethod: DatabasePaymentMethod;
    readonly note?: string;
  },
): DatabaseExpense {
  requireExpenseProduction(database);
  const eventId = requireExpenseEvent(database);

  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error('O valor da despesa deve ser positivo.');
  }

  const initialPaymentCents = input.initialPaymentCents ?? input.amountCents;

  if (
    !Number.isInteger(initialPaymentCents) ||
    initialPaymentCents < 0 ||
    initialPaymentCents > input.amountCents
  ) {
    throw new Error('O pagamento inicial deve ficar entre zero e o total da despesa.');
  }

  const category = input.category.trim();
  const description = input.description.trim();

  if (category.length < 2 || description.length < 2) {
    throw new Error('Categoria e descrição da despesa precisam ter pelo menos 2 caracteres.');
  }

  const expenseId = randomUUID();
  const note = normalizeExpenseText(input.note);
  const now = Date.now();

  database.sqlite.transaction(() => {
    database.sqlite
      .prepare(
        `INSERT INTO expenses
         (id, event_id, category, description, amount_cents, payment_method,
          note, status, created_at, cancelled_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, NULL, ?)`,
      )
      .run(
        expenseId,
        eventId,
        category,
        description,
        input.amountCents,
        input.paymentMethod,
        note,
        now,
        now,
      );

    if (initialPaymentCents > 0) {
      insertExpensePayment(database, {
        eventId,
        expenseId,
        paymentMethod: input.paymentMethod,
        amountCents: initialPaymentCents,
        note,
        createdAt: now,
      });
    }

    appendAudit(database, {
      action: 'expense.created',
      entityType: 'expense',
      entityId: expenseId,
      eventId,
      after: {
        category,
        description,
        initialPaymentCents,
        note,
        totalCents: input.amountCents,
      },
      impact: { paidCents: initialPaymentCents },
      details: { paymentMethod: input.paymentMethod },
    });
  })();

  return getExpenseWithPayments(database, expenseId);
}

export function updateExpense(
  database: DatabaseContext,
  input: {
    readonly expenseId: string;
    readonly category: string;
    readonly description: string;
    readonly amountCents: number;
    readonly note?: string;
  },
): DatabaseExpense {
  requireExpenseProduction(database);
  const eventId = requireExpenseEvent(database);
  const expense = getExpenseWithPayments(database, input.expenseId);

  if (expense.eventId !== eventId) {
    throw new Error('A despesa não pertence ao evento ativo.');
  }

  if (expense.status === 'cancelled') {
    throw new Error('Despesa cancelada não pode ser editada.');
  }

  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error('O valor total da despesa deve ser positivo.');
  }

  if (input.amountCents < expense.paidCents) {
    throw new Error('O valor total não pode ficar abaixo do valor já pago.');
  }

  const category = input.category.trim();
  const description = input.description.trim();

  if (category.length < 2 || description.length < 2) {
    throw new Error('Categoria e descrição da despesa precisam ter pelo menos 2 caracteres.');
  }

  const note = normalizeExpenseText(input.note);
  const now = Date.now();
  const nextPendingCents = input.amountCents - expense.paidCents;
  const nextStatus: DatabaseExpenseStatus =
    expense.paidCents === 0 ? 'open' : nextPendingCents === 0 ? 'paid' : 'partial';

  database.sqlite.transaction(() => {
    database.sqlite
      .prepare(
        `UPDATE expenses
         SET category = ?, description = ?, amount_cents = ?, note = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(category, description, input.amountCents, note, now, expense.id);
    appendAudit(database, {
      action: 'expense.updated',
      entityType: 'expense',
      entityId: expense.id,
      eventId,
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
        category,
        description,
        note,
        paidCents: expense.paidCents,
        pendingCents: nextPendingCents,
        status: nextStatus,
        totalCents: input.amountCents,
      },
      impact: { totalDifferenceCents: input.amountCents - expense.totalCents },
    });
  })();

  return getExpenseWithPayments(database, expense.id);
}

export function payExpense(
  database: DatabaseContext,
  input: {
    readonly expenseId: string;
    readonly amountCents: number;
    readonly paymentMethod: DatabasePaymentMethod;
    readonly note?: string;
  },
): DatabaseExpense {
  requireExpenseProduction(database);
  const eventId = requireExpenseEvent(database);
  const expense = getExpenseWithPayments(database, input.expenseId);

  if (expense.eventId !== eventId) {
    throw new Error('A despesa não pertence ao evento ativo.');
  }

  if (expense.status === 'cancelled') {
    throw new Error('Despesa cancelada não pode receber pagamento.');
  }

  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error('O pagamento da despesa deve ser positivo.');
  }

  if (input.amountCents > expense.pendingCents) {
    throw new Error('O pagamento não pode superar o saldo pendente da despesa.');
  }

  const note = normalizeExpenseText(input.note);
  const now = Date.now();
  const nextPaidCents = expense.paidCents + input.amountCents;
  const nextPendingCents = expense.totalCents - nextPaidCents;
  const nextStatus: DatabaseExpenseStatus = nextPendingCents === 0 ? 'paid' : 'partial';

  database.sqlite.transaction(() => {
    const paymentId = insertExpensePayment(database, {
      eventId,
      expenseId: expense.id,
      paymentMethod: input.paymentMethod,
      amountCents: input.amountCents,
      note,
      createdAt: now,
    });
    database.sqlite.prepare('UPDATE expenses SET updated_at = ? WHERE id = ?').run(now, expense.id);
    appendAudit(database, {
      action: 'expense.payment-created',
      entityType: 'expense',
      entityId: expense.id,
      eventId,
      before: {
        paidCents: expense.paidCents,
        pendingCents: expense.pendingCents,
        status: expense.status,
      },
      after: { paidCents: nextPaidCents, pendingCents: nextPendingCents, status: nextStatus },
      impact: { amountCents: input.amountCents, paymentMethod: input.paymentMethod },
      details: { paymentId, note },
    });
  })();

  return getExpenseWithPayments(database, expense.id);
}
