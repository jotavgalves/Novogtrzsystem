import { randomUUID } from 'node:crypto';

import { getSessionState } from './control';
import type { DatabasePaymentMethod } from './operation-types';
import type { DatabaseContext } from './types';

export type DatabaseExpenseStatus = 'open' | 'partial' | 'paid' | 'cancelled';
export type DatabaseExpensePaymentStatus = 'active' | 'refunded';

export interface DatabaseExpensePayment {
  readonly id: string;
  readonly eventId: string;
  readonly expenseId: string;
  readonly paymentMethod: DatabasePaymentMethod;
  readonly amountCents: number;
  readonly note: string | null;
  readonly status: DatabaseExpensePaymentStatus;
  readonly createdAt: number;
  readonly refundedAt: number | null;
}

export interface DatabaseExpense {
  readonly id: string;
  readonly eventId: string;
  readonly category: string;
  readonly description: string;
  readonly amountCents: number;
  readonly totalCents: number;
  readonly paidCents: number;
  readonly pendingCents: number;
  readonly paymentMethod: DatabasePaymentMethod | null;
  readonly note: string | null;
  readonly status: DatabaseExpenseStatus;
  readonly payments: readonly DatabaseExpensePayment[];
  readonly createdAt: number;
  readonly cancelledAt: number | null;
  readonly updatedAt: number;
}

export interface DatabaseExpenseState {
  readonly activeEventId: string | null;
  readonly expenses: readonly DatabaseExpense[];
}

interface ExpenseRow {
  readonly id: string;
  readonly event_id: string;
  readonly category: string;
  readonly description: string;
  readonly amount_cents: number;
  readonly payment_method: DatabasePaymentMethod;
  readonly note: string | null;
  readonly status: 'active' | 'cancelled';
  readonly created_at: number;
  readonly cancelled_at: number | null;
  readonly updated_at: number;
}

interface ExpensePaymentRow {
  readonly id: string;
  readonly event_id: string;
  readonly expense_id: string;
  readonly payment_method: DatabasePaymentMethod;
  readonly amount_cents: number;
  readonly note: string | null;
  readonly status: DatabaseExpensePaymentStatus;
  readonly created_at: number;
  readonly refunded_at: number | null;
}

export function requireExpenseProduction(database: DatabaseContext): void {
  if (getSessionState(database).profile !== 'production') {
    throw new Error('A administração de despesas exige o perfil Produção.');
  }
}

export function requireExpenseEvent(database: DatabaseContext): string {
  const eventId = getSessionState(database).activeEvent?.id;

  if (eventId === undefined) {
    throw new Error('Selecione um evento aberto antes de registrar despesas.');
  }

  return eventId;
}

export function normalizeExpenseText(value?: string): string | null {
  const normalized = value?.trim();
  return normalized === undefined || normalized.length === 0 ? null : normalized;
}

function mapPayment(row: ExpensePaymentRow): DatabaseExpensePayment {
  return {
    id: row.id,
    eventId: row.event_id,
    expenseId: row.expense_id,
    paymentMethod: row.payment_method,
    amountCents: row.amount_cents,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
    refundedAt: row.refunded_at,
  };
}

function resolveExpenseStatus(
  row: ExpenseRow,
  paidCents: number,
): Pick<DatabaseExpense, 'pendingCents' | 'status'> {
  if (row.status === 'cancelled') {
    return { pendingCents: 0, status: 'cancelled' };
  }

  const pendingCents = Math.max(row.amount_cents - paidCents, 0);

  if (paidCents === 0) return { pendingCents, status: 'open' };
  if (pendingCents > 0) return { pendingCents, status: 'partial' };
  return { pendingCents: 0, status: 'paid' };
}

function mapExpense(row: ExpenseRow, payments: readonly DatabaseExpensePayment[]): DatabaseExpense {
  const paidCents = payments
    .filter((payment) => payment.status === 'active')
    .reduce((total, payment) => total + payment.amountCents, 0);
  const status = resolveExpenseStatus(row, paidCents);
  const latestPayment = payments.find((payment) => payment.status === 'active');

  return {
    id: row.id,
    eventId: row.event_id,
    category: row.category,
    description: row.description,
    amountCents: row.amount_cents,
    totalCents: row.amount_cents,
    paidCents,
    pendingCents: status.pendingCents,
    paymentMethod: latestPayment?.paymentMethod ?? (paidCents > 0 ? row.payment_method : null),
    note: row.note,
    status: status.status,
    payments,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
    updatedAt: row.updated_at,
  };
}

function requireExpenseRow(database: DatabaseContext, expenseId: string): ExpenseRow {
  const row = database.sqlite
    .prepare(
      `SELECT id, event_id, category, description, amount_cents, payment_method,
              note, status, created_at, cancelled_at, updated_at
       FROM expenses WHERE id = ?`,
    )
    .get(expenseId) as ExpenseRow | undefined;

  if (row === undefined) {
    throw new Error('A despesa informada não existe.');
  }

  return row;
}

function listPaymentRows(
  database: DatabaseContext,
  expenseIds: readonly string[],
): ExpensePaymentRow[] {
  if (expenseIds.length === 0) {
    return [];
  }

  const placeholders = expenseIds.map(() => '?').join(', ');
  return database.sqlite
    .prepare(
      `SELECT id, event_id, expense_id, payment_method, amount_cents,
              note, status, created_at, refunded_at
       FROM expense_payments
       WHERE expense_id IN (${placeholders})
       ORDER BY created_at DESC, id DESC`,
    )
    .all(...expenseIds) as ExpensePaymentRow[];
}

export function listExpensesForEvent(
  database: DatabaseContext,
  eventId: string,
): readonly DatabaseExpense[] {
  const rows = database.sqlite
    .prepare(
      `SELECT id, event_id, category, description, amount_cents, payment_method,
              note, status, created_at, cancelled_at, updated_at
       FROM expenses
       WHERE event_id = ?
       ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, updated_at DESC`,
    )
    .all(eventId) as ExpenseRow[];
  const paymentsByExpense = new Map<string, DatabaseExpensePayment[]>();

  for (const payment of listPaymentRows(
    database,
    rows.map((row) => row.id),
  ).map(mapPayment)) {
    const current = paymentsByExpense.get(payment.expenseId) ?? [];
    current.push(payment);
    paymentsByExpense.set(payment.expenseId, current);
  }

  return rows.map((row) => mapExpense(row, paymentsByExpense.get(row.id) ?? []));
}

export function getExpenseWithPayments(
  database: DatabaseContext,
  expenseId: string,
): DatabaseExpense {
  const expense = requireExpenseRow(database, expenseId);
  const payments = listPaymentRows(database, [expense.id]).map(mapPayment);
  return mapExpense(expense, payments);
}

export function insertExpensePayment(
  database: DatabaseContext,
  input: {
    readonly eventId: string;
    readonly expenseId: string;
    readonly paymentMethod: DatabasePaymentMethod;
    readonly amountCents: number;
    readonly note: string | null;
    readonly createdAt: number;
  },
): string {
  const paymentId = randomUUID();
  database.sqlite
    .prepare(
      `INSERT INTO expense_payments
       (id, event_id, expense_id, payment_method, amount_cents, note, status, created_at, refunded_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, NULL)`,
    )
    .run(
      paymentId,
      input.eventId,
      input.expenseId,
      input.paymentMethod,
      input.amountCents,
      input.note,
      input.createdAt,
    );
  return paymentId;
}
