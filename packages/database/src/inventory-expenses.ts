import type { DatabaseContext } from './types';

/**
 * Soma o custo das entradas de estoque classificadas como compra no evento.
 * O caixa físico continua sendo afetado somente quando existe uma saída financeira registrada.
 */
export function getInventoryPurchaseExpenseCents(
  database: DatabaseContext,
  eventId: string,
): number {
  const row = database.sqlite
    .prepare(
      `SELECT COALESCE(SUM(sm.quantity * p.cost_cents), 0) AS value
       FROM stock_movements sm
       INNER JOIN products p ON p.id = sm.product_id
       WHERE sm.event_id = ? AND sm.type = 'purchase'`,
    )
    .get(eventId) as { readonly value: number };

  return row.value;
}
