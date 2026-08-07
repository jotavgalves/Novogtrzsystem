import { randomUUID } from 'node:crypto';

import { appendAudit } from './audit';
import { getSessionState } from './control';
import { failDatabaseOperation } from './database-error';
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
    failDatabaseOperation('VALIDATION_ERROR', 'O valor da despesa deve ser positivo.', {
      field: 'amountCents',
      value: input.amountCents,
    });
  }

  const initialPaymentCents = input.initialPaymentCents ?? input.amountCents;

  if (
    !Number.isInteger(initialPaymentCents) ||
    initialPaymentCents < 0 ||
    initialPaymentCents > input.amountCents
  ) {
    failDatabaseOperation(
      'VALIDATION_ERROR',
      'O pagamento inicial deve ficar entre zero e o total da despesa.',
      {
        field: 'initialPaymentCents',
        value: initialPaymentCents,
        totalCents: input.amountCents,
      },
    );
  }

  const category = input.category.trim();
  const description = input.description.trim();

  if (category.length < 2 || description.length < 2) {
    failDatabaseOperation(
      'VALIDATION_ERROR',
      'Categoria e descrição da despesa precisam ter pelo menos 2 caracteres.',
      { categoryLength: category.length, descriptionLength: description.length },
    );
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
    failDatabaseOperation('INVALID_STATE', 'A despesa não pertence ao evento ativo.', {
      expenseId: expense.id,
      expenseEventId: expense.eventId,
      activeEventId: eventId,
    });
  }

  if (expense.status === 'cancelled') {
    failDatabaseOperation('INVALID_STATE', 'Despesa cancelada não pode ser editada.', {
      expenseId: expense.id,
      status: expense.status,
    });
  }

  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    failDatabaseOperation('VALIDATION_ERROR', 'O valor total da despesa deve ser positivo.', {
      field: 'amountCents',
      value: input.amountCents,
    });
  }

  if (input.amountCents < expense.paidCents) {
    failDatabaseOperation(
      'INVALID_STATE',
      'O valor total não pode ficar abaixo do valor já pago.',
      {
        expenseId: expense.id,
        requestedTotalCents: input.amountCents,
        paidCents: expense.paidCents,
      },
    );
  }

  const category = input.category.trim();
  const description = input.description.trim();

  if (category.length < 2 || description.length < 2) {
    failDatabaseOperation(
      'VALIDATION_ERROR',
      'Categoria e descrição da despesa precisam ter pelo menos 2 caracteres.',
      { categoryLength: category.length, descriptionLength: description.length },
    );
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
    failDatabaseOperation('INVALID_STATE', 'A despesa não pertence ao evento ativo.', {
      expenseId: expense.id,
      expenseEventId: expense.eventId,
      activeEventId: eventId,
    });
  }

  if (expense.status === 'cancelled') {
    failDatabaseOperation('INVALID_STATE', 'Despesa cancelada não pode receber pagamento.', {
      expenseId: expense.id,
      status: expense.status,
    });
  }

  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    failDatabaseOperation('VALIDATION_ERROR', 'O pagamento da despesa deve ser positivo.', {
      field: 'amountCents',
      value: input.amountCents,
    });
  }

  if (input.amountCents > expense.pendingCents) {
    failDatabaseOperation(
      'INVALID_STATE',
      'O pagamento não pode superar o saldo pendente da despesa.',
      {
        expenseId: expense.id,
        requestedCents: input.amountCents,
        pendingCents: expense.pendingCents,
      },
    );
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
