import { randomBytes, randomUUID } from 'node:crypto';

import { failDatabaseOperation } from './database-error';
import type { DatabaseContext } from './types';
import type {
  DatabaseVoucher,
  DatabaseVoucherStatus,
  DatabaseVoucherTransaction,
  DatabaseVoucherTransactionType,
} from './voucher-types';

export interface VoucherRow {
  readonly id: string;
  readonly event_id: string;
  readonly code: string;
  readonly label: string;
  readonly linked_service_point_id: string | null;
  readonly linked_service_point_label: string | null;
  readonly initial_balance_cents: number;
  readonly remaining_balance_cents: number;
  readonly status: DatabaseVoucherStatus;
  readonly created_at: number;
  readonly updated_at: number;
}

export interface VoucherTransactionRow {
  readonly id: string;
  readonly event_id: string;
  readonly voucher_id: string;
  readonly voucher_code: string;
  readonly order_id: string | null;
  readonly type: DatabaseVoucherTransactionType;
  readonly amount_cents: number;
  readonly balance_before_cents: number;
  readonly balance_after_cents: number;
  readonly note: string | null;
  readonly created_at: number;
}

export interface VoucherRefundRow {
  readonly voucher_id: string;
  readonly voucher_code: string;
  readonly amount_cents: number;
}

export function normalizeCode(code: string): string {
  return code.trim().toLocaleUpperCase('pt-BR').replaceAll(/\s+/gu, '-');
}

export function generateVoucherCode(): string {
  return `GTRZ-${randomBytes(4).toString('hex').toLocaleUpperCase('pt-BR')}`;
}

export function mapVoucher(row: VoucherRow): DatabaseVoucher {
  return {
    id: row.id,
    eventId: row.event_id,
    code: row.code,
    label: row.label,
    linkedServicePointId: row.linked_service_point_id,
    linkedServicePointLabel: row.linked_service_point_label,
    initialBalanceCents: row.initial_balance_cents,
    remainingBalanceCents: row.remaining_balance_cents,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapVoucherTransaction(row: VoucherTransactionRow): DatabaseVoucherTransaction {
  return {
    id: row.id,
    eventId: row.event_id,
    voucherId: row.voucher_id,
    voucherCode: row.voucher_code,
    orderId: row.order_id,
    type: row.type,
    amountCents: row.amount_cents,
    balanceBeforeCents: row.balance_before_cents,
    balanceAfterCents: row.balance_after_cents,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function requireVoucherById(database: DatabaseContext, voucherId: string): VoucherRow {
  const row = database.sqlite
    .prepare(
      `SELECT id, event_id, code, label, linked_service_point_id, linked_service_point_label,
              initial_balance_cents, remaining_balance_cents, status, created_at, updated_at
       FROM vouchers WHERE id = ?`,
    )
    .get(voucherId) as VoucherRow | undefined;

  if (row === undefined) {
    failDatabaseOperation('NOT_FOUND', 'O voucher informado não existe.', { voucherId });
  }

  return row;
}

export function requireVoucherByCode(
  database: DatabaseContext,
  eventId: string,
  code: string,
): VoucherRow {
  const normalizedCode = normalizeCode(code);
  const row = database.sqlite
    .prepare(
      `SELECT id, event_id, code, label, linked_service_point_id, linked_service_point_label,
              initial_balance_cents, remaining_balance_cents, status, created_at, updated_at
       FROM vouchers
       WHERE event_id = ? AND code = ? COLLATE NOCASE`,
    )
    .get(eventId, normalizedCode) as VoucherRow | undefined;

  if (row === undefined) {
    failDatabaseOperation('NOT_FOUND', `Voucher ${normalizedCode} não encontrado neste evento.`, {
      eventId,
      code: normalizedCode,
    });
  }

  return row;
}

export function insertTransaction(
  database: DatabaseContext,
  input: Omit<DatabaseVoucherTransaction, 'id'>,
): void {
  database.sqlite
    .prepare(
      `INSERT INTO voucher_transactions
       (id, event_id, voucher_id, voucher_code, order_id, type, amount_cents,
        balance_before_cents, balance_after_cents, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      input.eventId,
      input.voucherId,
      input.voucherCode,
      input.orderId,
      input.type,
      input.amountCents,
      input.balanceBeforeCents,
      input.balanceAfterCents,
      input.note,
      input.createdAt,
    );
}
