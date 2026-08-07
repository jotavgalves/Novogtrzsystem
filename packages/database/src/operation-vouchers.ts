import { appendAudit } from './audit';
import type { DatabaseContext } from './types';
import type { DatabaseVoucherUseInput } from './voucher-types';

export interface DatabaseOrderVoucherAllocation {
  readonly voucherId: string;
  readonly code: string;
  readonly label: string;
  readonly remainingBalanceCents: number;
  readonly status: 'active' | 'exhausted' | 'cancelled';
  readonly createdAt: number;
  readonly updatedAt: number;
}

interface OrderRow {
  readonly id: string;
  readonly event_id: string;
  readonly service_point_label: string;
  readonly status: 'open' | 'paid' | 'cancelled';
}

interface AllocationRow {
  readonly voucher_id: string;
  readonly code: string;
  readonly label: string;
  readonly remaining_balance_cents: number;
  readonly status: 'active' | 'exhausted' | 'cancelled';
  readonly created_at: number;
  readonly updated_at: number;
}

interface VoucherRow {
  readonly id: string;
  readonly event_id: string;
  readonly code: string;
  readonly label: string;
  readonly remaining_balance_cents: number;
  readonly status: 'active' | 'exhausted' | 'cancelled';
}

function normalizeCode(code: string): string {
  return code.trim().toLocaleUpperCase('pt-BR').replaceAll(/\s+/gu, '-');
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function requireOpenOrder(database: DatabaseContext, orderId: string): OrderRow {
  const order = database.sqlite
    .prepare(
      `SELECT id, event_id, service_point_label, status
       FROM orders
       WHERE id = ?`,
    )
    .get(orderId) as OrderRow | undefined;

  if (order === undefined) {
    throw new Error('A comanda informada não existe.');
  }

  if (order.status !== 'open') {
    throw new Error('Somente comandas abertas podem receber vouchers.');
  }

  return order;
}

function requireVoucher(database: DatabaseContext, eventId: string, code: string): VoucherRow {
  const normalizedCode = normalizeCode(code);
  const voucher = database.sqlite
    .prepare(
      `SELECT id, event_id, code, label, remaining_balance_cents, status
       FROM vouchers
       WHERE event_id = ? AND code = ? COLLATE NOCASE`,
    )
    .get(eventId, normalizedCode) as VoucherRow | undefined;

  if (voucher === undefined) {
    throw new Error(`Voucher ${normalizedCode} não encontrado neste evento.`);
  }

  return voucher;
}

function mapAllocation(row: AllocationRow): DatabaseOrderVoucherAllocation {
  return {
    voucherId: row.voucher_id,
    code: row.code,
    label: row.label,
    remainingBalanceCents: row.remaining_balance_cents,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getOrderVoucherAllocation(
  database: DatabaseContext,
  orderId: string,
): DatabaseOrderVoucherAllocation | null {
  const row = database.sqlite
    .prepare(
      `SELECT
         ova.voucher_id,
         v.code,
         v.label,
         v.remaining_balance_cents,
         v.status,
         ova.created_at,
         ova.updated_at
       FROM order_voucher_allocations ova
       INNER JOIN vouchers v ON v.id = ova.voucher_id
       WHERE ova.order_id = ?`,
    )
    .get(orderId) as AllocationRow | undefined;

  return row === undefined ? null : mapAllocation(row);
}

export function bindOrderVoucher(
  database: DatabaseContext,
  input: { readonly orderId: string; readonly code: string },
): DatabaseOrderVoucherAllocation {
  const order = requireOpenOrder(database, input.orderId);
  const voucher = requireVoucher(database, order.event_id, input.code);

  if (voucher.status !== 'active' || voucher.remaining_balance_cents <= 0) {
    throw new Error(`O voucher ${voucher.code} não possui saldo ativo para uso.`);
  }

  const conflictingOrder = database.sqlite
    .prepare(
      `SELECT o.service_point_label
       FROM order_voucher_allocations ova
       INNER JOIN orders o ON o.id = ova.order_id
       WHERE ova.voucher_id = ? AND ova.order_id != ? AND o.status = 'open'`,
    )
    .get(voucher.id, order.id) as { readonly service_point_label: string } | undefined;

  if (conflictingOrder !== undefined) {
    throw new Error(
      `O voucher ${voucher.code} já está vinculado a ${conflictingOrder.service_point_label}.`,
    );
  }

  const current = getOrderVoucherAllocation(database, order.id);

  if (current?.voucherId === voucher.id) {
    return current;
  }

  const now = Date.now();
  database.sqlite.transaction(() => {
    database.sqlite
      .prepare('DELETE FROM order_voucher_allocations WHERE order_id = ?')
      .run(order.id);
    database.sqlite
      .prepare(
        `INSERT INTO order_voucher_allocations
         (order_id, event_id, voucher_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(order.id, order.event_id, voucher.id, now, now);
    appendAudit(database, {
      action: 'voucher.linked-to-order',
      entityType: 'voucher',
      entityId: voucher.id,
      eventId: order.event_id,
      details: {
        code: voucher.code,
        orderId: order.id,
        previousVoucherCode: current?.code ?? null,
        servicePointLabel: order.service_point_label,
      },
    });
  })();

  const allocation = getOrderVoucherAllocation(database, order.id);

  if (allocation === null) {
    throw new Error('O voucher foi vinculado, mas não pôde ser carregado.');
  }

  return allocation;
}

export function unbindOrderVoucher(database: DatabaseContext, orderId: string): void {
  const order = requireOpenOrder(database, orderId);
  const allocation = getOrderVoucherAllocation(database, order.id);

  if (allocation === null) {
    return;
  }

  database.sqlite.transaction(() => {
    database.sqlite
      .prepare('DELETE FROM order_voucher_allocations WHERE order_id = ?')
      .run(order.id);
    appendAudit(database, {
      action: 'voucher.unlinked-from-order',
      entityType: 'voucher',
      entityId: allocation.voucherId,
      eventId: order.event_id,
      details: {
        code: allocation.code,
        orderId: order.id,
        servicePointLabel: order.service_point_label,
      },
    });
  })();
}

export function releaseOrderVoucher(database: DatabaseContext, orderId: string): void {
  database.sqlite.prepare('DELETE FROM order_voucher_allocations WHERE order_id = ?').run(orderId);
}

export function validateOrderVoucherUses(
  database: DatabaseContext,
  orderId: string,
  uses: readonly DatabaseVoucherUseInput[],
): readonly DatabaseVoucherUseInput[] {
  if (uses.length > 1) {
    throw new Error('Cada comanda pode utilizar somente um voucher.');
  }

  if (uses.length === 0) {
    return [];
  }

  const allocation = getOrderVoucherAllocation(database, orderId);

  if (allocation === null) {
    throw new Error('Vincule o voucher à mesa antes de concluir a venda.');
  }

  const use = uses[0];

  if (use === undefined) {
    return [];
  }

  if (normalizeCode(use.code) !== allocation.code) {
    throw new Error('O voucher informado não corresponde ao voucher vinculado à mesa.');
  }

  if (allocation.status !== 'active') {
    throw new Error(`O voucher ${allocation.code} não está ativo.`);
  }

  if (use.amountCents > allocation.remainingBalanceCents) {
    throw new Error(
      `Saldo insuficiente no voucher ${allocation.code}. Disponível: ${formatMoney(allocation.remainingBalanceCents)}.`,
    );
  }

  return [{ code: allocation.code, amountCents: use.amountCents }];
}
