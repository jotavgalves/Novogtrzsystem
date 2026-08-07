import { randomUUID } from 'node:crypto';

import { appendAudit } from './audit';
import { cancelOrder } from './operation-cancellation';
import { requireOperationReason } from './operation-validation';
import type { DatabaseContext } from './types';
import {
  calculateVoucherDeleteImpact,
  type DatabaseVoucherDeleteFinancialImpact,
  type DatabaseVoucherDeletePaymentImpact,
  type DatabaseVoucherDeleteStockImpact,
} from './voucher-delete-impact';
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

export { listAvailableVouchersForServicePoint } from './voucher-checkout-query';

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
  readonly affectedPayments: readonly DatabaseVoucherDeletePaymentImpact[];
  readonly stockReturns: readonly DatabaseVoucherDeleteStockImpact[];
  readonly financialImpact: DatabaseVoucherDeleteFinancialImpact;
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

  if (voucher.status === 'cancelled') {
    throw new Error('Este voucher já está cancelado.');
  }

  const impact = calculateVoucherDeleteImpact(database, voucher.id);
  return {
    voucherId: voucher.id,
    code: voucher.code,
    label: voucher.label,
    remainingBalanceCents: voucher.remaining_balance_cents,
    openAllocations: impact.openAllocations,
    paidOrders: impact.paidOrders.length,
    paidOrderIds: impact.paidOrders.map((order) => order.order_id),
    refundVoucherCents: impact.financialImpact.voucherRefundCents,
    affectedOrderTotalCents: impact.financialImpact.affectedRevenueCents,
    affectedPayments: impact.affectedPayments,
    stockReturns: impact.stockReturns,
    financialImpact: impact.financialImpact,
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
      before,
      after: {
        code,
        label,
        linkedServicePointId: linkedServicePoint.linkedServicePointId,
        linkedServicePointLabel: linkedServicePoint.linkedServicePointLabel,
        initialBalanceCents: nextInitialBalance,
        remainingBalanceCents: nextRemainingBalance,
        status: nextStatus,
      },
      impact: {
        addedBalanceCents: input.addedBalanceCents,
      },
      details: {
        addedBalanceCents: input.addedBalanceCents,
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
  const voucher = requireVoucherById(database, preview.voucherId);
  const reason = requireOperationReason(input.reason);
  const correlationId = randomUUID();
  const eventId = requireActiveEvent(database);
  const before = mapVoucher(voucher);

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
    const after = mapVoucher(requireVoucherById(database, preview.voucherId));
    appendAudit(database, {
      action: 'voucher.deleted',
      entityType: 'voucher',
      entityId: preview.voucherId,
      eventId,
      correlationId,
      details: { reason },
      before,
      after,
      impact: preview,
    });
  })();

  return mapVoucher(requireVoucherById(database, preview.voucherId));
}
