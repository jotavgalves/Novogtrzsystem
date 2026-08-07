import { randomUUID } from 'node:crypto';

import { appendAudit } from './audit';
import { getOrder, recomputeOpenOrder, requireOpenOrderRow } from './operation-core';
import { requireAvailableCatalogItem } from './operation-stock';
import type { DatabaseOrder, DatabaseOrderItemKind } from './operation-types';
import type { DatabaseContext } from './types';

export function addOrderItem(
  database: DatabaseContext,
  input: {
    readonly orderId: string;
    readonly itemKind: DatabaseOrderItemKind;
    readonly itemId: string;
    readonly quantity: number;
  },
): DatabaseOrder {
  const order = requireOpenOrderRow(database, input.orderId);
  const existing = database.sqlite
    .prepare(
      `SELECT id, quantity FROM order_items
       WHERE order_id = ? AND item_kind = ? AND item_id = ?`,
    )
    .get(input.orderId, input.itemKind, input.itemId) as
    | { readonly id: string; readonly quantity: number }
    | undefined;
  const nextQuantity = (existing?.quantity ?? 0) + input.quantity;
  const item = requireAvailableCatalogItem(
    database,
    order.event_id,
    input.itemKind,
    input.itemId,
    nextQuantity,
  );
  const now = Date.now();

  database.sqlite.transaction(() => {
    if (existing === undefined) {
      database.sqlite
        .prepare(
          `INSERT INTO order_items
           (id, order_id, item_kind, item_id, item_name, quantity,
            unit_price_cents, total_cents, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          randomUUID(),
          input.orderId,
          input.itemKind,
          input.itemId,
          item.name,
          input.quantity,
          item.salePriceCents,
          item.salePriceCents * input.quantity,
          now,
        );
    } else {
      database.sqlite
        .prepare(
          `UPDATE order_items
           SET quantity = ?, total_cents = unit_price_cents * ?
           WHERE id = ?`,
        )
        .run(nextQuantity, nextQuantity, existing.id);
    }

    recomputeOpenOrder(database, input.orderId, now);
    appendAudit(database, {
      action: 'operations.item-added',
      entityType: 'order',
      entityId: input.orderId,
      eventId: order.event_id,
      details: {
        itemId: input.itemId,
        itemKind: input.itemKind,
        itemName: item.name,
        quantity: input.quantity,
      },
    });
  })();

  return getOrder(database, input.orderId);
}

export function removeOrderItem(
  database: DatabaseContext,
  input: { readonly orderId: string; readonly orderItemId: string },
): DatabaseOrder {
  const order = requireOpenOrderRow(database, input.orderId);
  const item = database.sqlite
    .prepare('SELECT item_name, quantity FROM order_items WHERE id = ? AND order_id = ?')
    .get(input.orderItemId, input.orderId) as
    | { readonly item_name: string; readonly quantity: number }
    | undefined;

  if (item === undefined) {
    throw new Error('O item informado não pertence à comanda.');
  }

  const now = Date.now();
  database.sqlite.transaction(() => {
    database.sqlite.prepare('DELETE FROM order_items WHERE id = ?').run(input.orderItemId);
    recomputeOpenOrder(database, input.orderId, now);
    appendAudit(database, {
      action: 'operations.item-removed',
      entityType: 'order',
      entityId: input.orderId,
      eventId: order.event_id,
      details: { itemName: item.item_name, quantity: item.quantity },
    });
  })();

  return getOrder(database, input.orderId);
}
