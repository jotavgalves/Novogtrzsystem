import { appendAudit } from './audit';
import { getSessionState } from './control';
import { failDatabaseOperation } from './database-error';
import { getOrder, requireActiveOperationEvent, requireOrderRow } from './operation-core';
import { restoreOrderStock } from './operation-stock';
import type { DatabaseOrder } from './operation-types';
import { requireOperationReason } from './operation-validation';
import { releaseOrderVoucher } from './operation-vouchers';
import type { DatabaseContext } from './types';
import { refundOrderVouchers } from './vouchers';

function requireProduction(database: DatabaseContext): void {
  if (getSessionState(database).profile !== 'production') {
    failDatabaseOperation('FORBIDDEN', 'O cancelamento de comandas exige o perfil Produção.', {
      requiredProfile: 'production',
    });
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
    failDatabaseOperation('INVALID_STATE', 'A comanda não pertence ao evento ativo.', {
      orderId: order.id,
      orderEventId: order.event_id,
      activeEventId: eventId,
    });
  }

  if (order.status === 'cancelled') {
    failDatabaseOperation('CONFLICT', 'Esta comanda já foi cancelada.', {
      orderId: order.id,
      status: order.status,
    });
  }

  const reason = requireOperationReason(input.reason);
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
