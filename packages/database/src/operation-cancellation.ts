import { appendAudit } from './audit';
import { getSessionState } from './control';
import { getOrder, requireActiveOperationEvent, requireOrderRow } from './operation-core';
import { restoreOrderStock } from './operation-stock';
import type { DatabaseOrder } from './operation-types';
import { releaseOrderVoucher } from './operation-vouchers';
import type { DatabaseContext } from './types';
import { refundOrderVouchers } from './vouchers';

function requireProduction(database: DatabaseContext): void {
  if (getSessionState(database).profile !== 'production') {
    throw new Error('O cancelamento de comandas exige o perfil Produção.');
  }
}

export function cancelOrder(
  database: DatabaseContext,
  input: { readonly orderId: string; readonly reason: string; readonly correlationId?: string },
): DatabaseOrder {
  requireProduction(database);
  const eventId = requireActiveOperationEvent(database);
  const order = requireOrderRow(database, input.orderId);

  if (order.event_id !== eventId) {
    throw new Error('A comanda não pertence ao evento ativo.');
  }

  if (order.status === 'cancelled') {
    throw new Error('Esta comanda já foi cancelada.');
  }

  const reason = input.reason.trim();
  const now = Date.now();
  let restoredUnits = 0;
  let refundedVoucherCents = 0;

  database.sqlite.transaction(() => {
    if (order.status === 'paid') {
      restoredUnits = restoreOrderStock(database, eventId, order.id, now);
      refundedVoucherCents = refundOrderVouchers(database, eventId, order.id, now);
    } else {
      releaseOrderVoucher(database, order.id);
    }

    database.sqlite
      .prepare(
        `UPDATE orders
         SET status = 'cancelled', closed_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(now, now, order.id);
    appendAudit(database, {
      action: 'operations.order-cancelled',
      entityType: 'order',
      entityId: order.id,
      eventId,
      correlationId: input.correlationId,
      details: {
        previousStatus: order.status,
        reason,
        refundedVoucherCents,
        restoredUnits,
        totalCents: order.total_cents,
      },
      before: { status: order.status, totalCents: order.total_cents },
      after: { status: 'cancelled' },
      impact: { refundedVoucherCents, restoredUnits },
    });
  })();

  return getOrder(database, order.id);
}
