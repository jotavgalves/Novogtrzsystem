import { randomUUID } from 'node:crypto';

import { appendAudit } from './audit';
import { cancelOrder } from './operation-cancellation';
import type { DatabaseContext } from './types';
import type { DatabaseVoucher, DatabaseVoucherStatus } from './voucher-types';
import { resolveLinkedServicePoint } from './voucher-service-points';
import {
  insertTransaction,
  mapVoucher,
  normalizeCode,
  requireActiveEvent,
  requireProduction,
  requireVoucherById,
} from './vouchers';

export interface DatabaseVoucherDeletePreview {
  readonly voucherId: string;
  readonly code: string;
  readonly label: string;
  readonly remainingBalanceCents: number;
  readonly openAllocations: number;
  readonly paidOrders: number;
  readonly paidOrderIds: readonly string[];
  readonly refundVoucherCents: number;
  readonly affectedOrderTotalCents: number;
}

interface VoucherImpactOrderRow {
  readonly order_id: string;
  readonly order_total_cents: number;
  readonly voucher_cents: number;
}

function getVoucherDeleteImpact(
  database: DatabaseContext,
  voucherId: string,
): {
  readonly openAllocations: number;
  readonly paidOrders: readonly VoucherImpactOrderRow[];
} {
  const openAllocations = database.sqlite
    .prepare(
      `SELECT COUNT(*) AS value
       FROM order_voucher_allocations ova
       INNER JOIN orders o ON o.id = ova.order_id
       WHERE ova.voucher_id = ? AND o.status = 'open'`,
    )
    .get(voucherId) as { readonly value: number };
  const paidOrders = database.sqlite
    .prepare(
      `SELECT
         o.id AS order_id,
         o.total_cents AS order_total_cents,
         SUM(vt.amount_cents) AS voucher_cents
       FROM voucher_transactions vt
       INNER JOIN orders o ON o.id = vt.order_id
       WHERE vt.voucher_id = ? AND vt.type = 'redemption' AND o.status = 'paid'
       GROUP BY o.id, o.total_cents
       ORDER BY o.closed_at DESC, o.id DESC`,
    )
    .all(voucherId) as VoucherImpactOrderRow[];

  return { openAllocations: openAllocations.value, paidOrders };
}

export function previewDeleteVoucher(
  database: DatabaseContext,
  input: { readonly voucherId: string },
): DatabaseVoucherDeletePreview {
  requireProduction(database);
  const eventId = requireActiveEvent(database);
  const voucher = requireVoucherById(database, input.voucherId);

  if (voucher.event_id !== eventId) {
    throw new Error('O voucher não pertence ao evento ativo.');
  }

  const impact = getVoucherDeleteImpact(database, voucher.id);
  return {
    voucherId: voucher.id,
    code: voucher.code,
    label: voucher.label,
    remainingBalanceCents: voucher.remaining_balance_cents,
    openAllocations: impact.openAllocations,
    paidOrders: impact.paidOrders.length,
    paidOrderIds: impact.paidOrders.map((order) => order.order_id),
    refundVoucherCents: impact.paidOrders.reduce((total, order) => total + order.voucher_cents, 0),
    affectedOrderTotalCents: impact.paidOrders.reduce(
      (total, order) => total + order.order_total_cents,
      0,
    ),
  };
}

export function updateVoucher(
  database: DatabaseContext,
  input: {
    readonly voucherId: string;
    readonly code: string;
    readonly label: string;
    readonly linkedServicePointId: string | null;
    readonly addedBalanceCents: number;
  },
): DatabaseVoucher {
  requireProduction(database);
  const eventId = requireActiveEvent(database);
  const voucher = requireVoucherById(database, input.voucherId);

  if (voucher.event_id !== eventId) {
    throw new Error('O voucher não pertence ao evento ativo.');
  }

  if (voucher.status === 'cancelled') {
    throw new Error('Reative o voucher antes de editá-lo.');
  }

  if (!Number.isInteger(input.addedBalanceCents) || input.addedBalanceCents < 0) {
    throw new Error('O acréscimo de saldo deve ser informado em centavos inteiros.');
  }

  const code = normalizeCode(input.code);
  const label = input.label.trim();
  const linkedServicePoint = resolveLinkedServicePoint(
    database,
    eventId,
    input.linkedServicePointId,
  );
  const duplicate = database.sqlite
    .prepare('SELECT id FROM vouchers WHERE event_id = ? AND code = ? COLLATE NOCASE AND id != ?')
    .get(eventId, code, voucher.id);

  if (duplicate !== undefined) {
    throw new Error('Já existe um voucher com esse código no evento.');
  }

  const nextInitialBalance = voucher.initial_balance_cents + input.addedBalanceCents;
  const nextRemainingBalance = voucher.remaining_balance_cents + input.addedBalanceCents;
  const nextStatus: DatabaseVoucherStatus =
    voucher.status === 'exhausted' && nextRemainingBalance > 0 ? 'active' : voucher.status;
  const now = Date.now();
  const before = mapVoucher(voucher);

  database.sqlite.transaction(() => {
    database.sqlite
      .prepare(
        `UPDATE vouchers
         SET code = ?,
             label = ?,
             linked_service_point_id = ?,
             linked_service_point_label = ?,
             initial_balance_cents = ?,
             remaining_balance_cents = ?,
             status = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(
        code,
        label,
        linkedServicePoint.linkedServicePointId,
        linkedServicePoint.linkedServicePointLabel,
        nextInitialBalance,
        nextRemainingBalance,
        nextStatus,
        now,
        voucher.id,
      );

    if (input.addedBalanceCents > 0) {
      insertTransaction(database, {
        eventId,
        voucherId: voucher.id,
        voucherCode: code,
        orderId: null,
        type: 'issue',
        amountCents: input.addedBalanceCents,
        balanceBeforeCents: voucher.remaining_balance_cents,
        balanceAfterCents: nextRemainingBalance,
        note: 'Acréscimo de saldo',
        createdAt: now,
      });
    }

    appendAudit(database, {
      action: 'voucher.updated',
      entityType: 'voucher',
      entityId: voucher.id,
      eventId,
      details: {
        after: {
          code,
          label,
          linkedServicePointId: linkedServicePoint.linkedServicePointId,
          linkedServicePointLabel: linkedServicePoint.linkedServicePointLabel,
          initialBalanceCents: nextInitialBalance,
          remainingBalanceCents: nextRemainingBalance,
          status: nextStatus,
        },
        before,
        impact: {
          addedBalanceCents: input.addedBalanceCents,
        },
      },
    });
  })();

  return mapVoucher(requireVoucherById(database, voucher.id));
}

export function deleteVoucher(
  database: DatabaseContext,
  input: { readonly voucherId: string; readonly reason: string },
): DatabaseVoucher {
  const preview = previewDeleteVoucher(database, input);
  const reason = input.reason.trim();
  const correlationId = randomUUID();
  const before = {
    code: preview.code,
    label: preview.label,
    remainingBalanceCents: preview.remainingBalanceCents,
    status: 'active',
  };

  database.sqlite.transaction(() => {
    for (const orderId of preview.paidOrderIds) {
      cancelOrder(database, {
        orderId,
        reason: `Exclusão do voucher ${preview.code}: ${reason}`,
        correlationId,
      });
    }

    const now = Date.now();
    database.sqlite
      .prepare('DELETE FROM order_voucher_allocations WHERE voucher_id = ?')
      .run(preview.voucherId);
    database.sqlite
      .prepare("UPDATE vouchers SET status = 'cancelled', updated_at = ? WHERE id = ?")
      .run(now, preview.voucherId);
    appendAudit(database, {
      action: 'voucher.deleted',
      entityType: 'voucher',
      entityId: preview.voucherId,
      eventId: requireActiveEvent(database),
      correlationId,
      details: {
        impact: preview,
        reason,
      },
      before,
      after: { status: 'cancelled' },
      impact: preview,
    });
  })();

  return mapVoucher(requireVoucherById(database, preview.voucherId));
}
