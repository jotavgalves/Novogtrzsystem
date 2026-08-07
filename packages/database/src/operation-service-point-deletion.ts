import { randomUUID } from 'node:crypto';

import { appendAudit } from './audit';
import { getSessionState } from './control';
import { failDatabaseOperation } from './database-error';
import { cancelOrder } from './operation-cancellation';
import { requireActiveOperationEvent } from './operation-core';
import { requireOperationReason } from './operation-validation';
import type { DatabaseContext } from './types';

export type DatabaseServicePointDeleteMode = 'keep-sales' | 'refund-sales';

export interface DatabaseServicePointDeletePreview {
  readonly servicePointId: string;
  readonly label: string;
  readonly openOrders: number;
  readonly paidOrders: number;
  readonly cancelledOrders: number;
  readonly paidSalesCents: number;
  readonly voucherConsumedCents: number;
  readonly linkedVouchers: number;
}

interface ServicePointRow {
  readonly id: string;
  readonly event_id: string;
  readonly label: string;
  readonly type: 'table' | 'counter';
  readonly active: number;
}

interface OrderSummaryRow {
  readonly open_orders: number;
  readonly paid_orders: number;
  readonly cancelled_orders: number;
  readonly paid_sales_cents: number;
}

interface OrderRow {
  readonly id: string;
  readonly status: 'open' | 'paid' | 'cancelled';
}

function requireProduction(database: DatabaseContext): void {
  if (getSessionState(database).profile !== 'production') {
    failDatabaseOperation('FORBIDDEN', 'A exclusão de mesas exige o perfil Produção.', {
      requiredProfile: 'production',
    });
  }
}

function requireActiveTable(database: DatabaseContext, servicePointId: string): ServicePointRow {
  const eventId = requireActiveOperationEvent(database);
  const servicePoint = database.sqlite
    .prepare(
      `SELECT id, event_id, label, type, active
       FROM service_points
       WHERE id = ?`,
    )
    .get(servicePointId) as ServicePointRow | undefined;

  if (servicePoint?.event_id !== eventId) {
    failDatabaseOperation('NOT_FOUND', 'A mesa informada não existe no evento ativo.', {
      servicePointId,
      eventId,
    });
  }

  if (servicePoint.type !== 'table') {
    failDatabaseOperation('INVALID_STATE', 'O balcão permanente não pode ser excluído.', {
      servicePointId,
      type: servicePoint.type,
    });
  }

  if (servicePoint.active !== 1) {
    failDatabaseOperation('CONFLICT', 'Esta mesa já foi excluída.', {
      servicePointId,
    });
  }

  return servicePoint;
}

export function previewDeleteServicePoint(
  database: DatabaseContext,
  input: { readonly servicePointId: string },
): DatabaseServicePointDeletePreview {
  requireProduction(database);
  const table = requireActiveTable(database, input.servicePointId);
  const summary = database.sqlite
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END), 0) AS open_orders,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END), 0) AS paid_orders,
         COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled_orders,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN total_cents ELSE 0 END), 0)
           AS paid_sales_cents
       FROM orders
       WHERE event_id = ? AND service_point_id = ?`,
    )
    .get(table.event_id, table.id) as OrderSummaryRow;
  const voucher = database.sqlite
    .prepare(
      `SELECT COALESCE(SUM(vt.amount_cents), 0) AS value
       FROM voucher_transactions vt
       INNER JOIN orders o ON o.id = vt.order_id
       WHERE o.event_id = ?
         AND o.service_point_id = ?
         AND o.status = 'paid'
         AND vt.type = 'redemption'`,
    )
    .get(table.event_id, table.id) as { readonly value: number };
  const linkedVouchers = database.sqlite
    .prepare(
      `SELECT COUNT(*) AS value
       FROM vouchers
       WHERE event_id = ? AND linked_service_point_id = ? AND status != 'cancelled'`,
    )
    .get(table.event_id, table.id) as { readonly value: number };

  return {
    servicePointId: table.id,
    label: table.label,
    openOrders: summary.open_orders,
    paidOrders: summary.paid_orders,
    cancelledOrders: summary.cancelled_orders,
    paidSalesCents: summary.paid_sales_cents,
    voucherConsumedCents: voucher.value,
    linkedVouchers: linkedVouchers.value,
  };
}

export function deleteServicePoint(
  database: DatabaseContext,
  input: {
    readonly servicePointId: string;
    readonly mode: DatabaseServicePointDeleteMode;
    readonly reason: string;
  },
): DatabaseServicePointDeletePreview {
  const preview = previewDeleteServicePoint(database, input);
  const eventId = requireActiveOperationEvent(database);
  const reason = requireOperationReason(input.reason);
  const correlationId = randomUUID();
  const now = Date.now();
  const orders = database.sqlite
    .prepare(
      `SELECT id, status
       FROM orders
       WHERE event_id = ? AND service_point_id = ? AND status IN ('open', 'paid')
       ORDER BY opened_at, id`,
    )
    .all(eventId, preview.servicePointId) as OrderRow[];

  database.sqlite.transaction(() => {
    for (const order of orders) {
      if (order.status === 'open' || input.mode === 'refund-sales') {
        cancelOrder(database, {
          orderId: order.id,
          reason: `Exclusão da mesa ${preview.label}: ${reason}`,
          correlationId,
        });
      }
    }

    database.sqlite
      .prepare(
        `UPDATE vouchers
         SET linked_service_point_id = NULL,
             linked_service_point_label = NULL,
             updated_at = ?
         WHERE linked_service_point_id = ?`,
      )
      .run(now, preview.servicePointId);
    database.sqlite
      .prepare('UPDATE service_points SET active = 0, updated_at = ? WHERE id = ?')
      .run(now, preview.servicePointId);

    appendAudit(database, {
      action: 'operations.service-point-deleted',
      entityType: 'service-point',
      entityId: preview.servicePointId,
      eventId,
      correlationId,
      details: {
        label: preview.label,
        mode: input.mode,
        reason,
      },
      before: { active: true, label: preview.label, type: 'table' },
      after: { active: false, label: preview.label, type: 'table' },
      impact: {
        ...preview,
        openOrdersCancelled: preview.openOrders,
        paidOrdersRefunded: input.mode === 'refund-sales' ? preview.paidOrders : 0,
        paidOrdersPreserved: input.mode === 'keep-sales' ? preview.paidOrders : 0,
        linkedVouchersDetached: preview.linkedVouchers,
      },
    });
  })();

  return preview;
}
