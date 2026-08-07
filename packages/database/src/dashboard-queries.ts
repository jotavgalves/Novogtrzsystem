import type { DatabaseContext } from './types';

interface DatabaseDashboardAggregates {
  readonly grossRevenueCents: number;
  readonly discountsCents: number;
  readonly netRevenueCents: number;
  readonly completedSales: number;
  readonly tickets: {
    readonly sold: number;
    readonly courtesy: number;
    readonly available: number;
    readonly revenueCents: number;
  };
  readonly vouchers: {
    readonly active: number;
    readonly outstandingBalanceCents: number;
  };
  readonly inventory: {
    readonly units: number;
    readonly activeProducts: number;
    readonly lowStockProducts: number;
    readonly stockCostCents: number;
  };
}

interface OrderFinancialRow {
  readonly gross_cents: number;
  readonly discount_cents: number;
  readonly net_cents: number;
  readonly completed_sales: number;
}

interface TicketAggregateRow {
  readonly sold: number;
  readonly courtesy: number;
  readonly revenue_cents: number;
  readonly paid_sales: number;
}

interface CountRow {
  readonly value: number;
}

interface VoucherAggregateRow {
  readonly active: number;
  readonly outstanding_balance_cents: number;
}

interface InventoryAggregateRow {
  readonly units: number;
  readonly active_products: number;
  readonly low_stock_products: number;
  readonly stock_cost_cents: number;
}

function getTicketAvailability(database: DatabaseContext, eventId: string): number {
  const row = database.sqlite
    .prepare(
      `SELECT COALESCE(SUM(tl.capacity - COALESCE(used.used_quantity, 0)), 0) AS value
       FROM ticket_lots tl
       LEFT JOIN (
         SELECT ts.lot_id, COUNT(tc.id) AS used_quantity
         FROM ticket_codes tc
         INNER JOIN ticket_sales ts ON ts.id = tc.sale_id
         WHERE tc.event_id = ? AND tc.status = 'valid'
         GROUP BY ts.lot_id
       ) used ON used.lot_id = tl.id
       WHERE tl.event_id = ? AND tl.active = 1`,
    )
    .get(eventId, eventId) as CountRow;
  return row.value;
}

export function getDashboardAggregates(
  database: DatabaseContext,
  eventId: string,
): DatabaseDashboardAggregates {
  const order = database.sqlite
    .prepare(
      `SELECT
         COALESCE(SUM(subtotal_cents), 0) AS gross_cents,
         COALESCE(SUM(discount_cents), 0) AS discount_cents,
         COALESCE(SUM(total_cents), 0) AS net_cents,
         COUNT(*) AS completed_sales
       FROM orders
       WHERE event_id = ? AND status = 'paid'`,
    )
    .get(eventId) as OrderFinancialRow;
  const ticket = database.sqlite
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN source != 'courtesy' THEN quantity ELSE 0 END), 0) AS sold,
         COALESCE(SUM(CASE WHEN source = 'courtesy' THEN quantity ELSE 0 END), 0) AS courtesy,
         COALESCE(SUM(CASE WHEN source != 'courtesy' THEN total_cents ELSE 0 END), 0)
           AS revenue_cents,
         COALESCE(SUM(CASE WHEN source != 'courtesy' THEN 1 ELSE 0 END), 0) AS paid_sales
       FROM ticket_sales
       WHERE event_id = ? AND status = 'active'`,
    )
    .get(eventId) as TicketAggregateRow;
  const vouchers = database.sqlite
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active,
         COALESCE(SUM(CASE WHEN status = 'active' THEN remaining_balance_cents ELSE 0 END), 0)
           AS outstanding_balance_cents
       FROM vouchers
       WHERE event_id = ?`,
    )
    .get(eventId) as VoucherAggregateRow;
  const inventory = database.sqlite
    .prepare(
      `SELECT
         COALESCE(SUM(COALESCE(es.quantity, 0)), 0) AS units,
         COALESCE(SUM(CASE WHEN p.active = 1 THEN 1 ELSE 0 END), 0) AS active_products,
         COALESCE(SUM(
           CASE
             WHEN p.active = 1 AND COALESCE(es.quantity, 0) <= p.low_stock_threshold THEN 1
             ELSE 0
           END
         ), 0) AS low_stock_products,
         COALESCE(SUM(COALESCE(es.quantity, 0) * p.cost_cents), 0) AS stock_cost_cents
       FROM products p
       LEFT JOIN event_stock es ON es.product_id = p.id AND es.event_id = ?`,
    )
    .get(eventId) as InventoryAggregateRow;
  const ticketRevenueCents = ticket.revenue_cents;

  return {
    grossRevenueCents: order.gross_cents + ticketRevenueCents,
    discountsCents: order.discount_cents,
    netRevenueCents: order.net_cents + ticketRevenueCents,
    completedSales: order.completed_sales + ticket.paid_sales,
    tickets: {
      sold: ticket.sold,
      courtesy: ticket.courtesy,
      available: getTicketAvailability(database, eventId),
      revenueCents: ticketRevenueCents,
    },
    vouchers: {
      active: vouchers.active,
      outstandingBalanceCents: vouchers.outstanding_balance_cents,
    },
    inventory: {
      units: inventory.units,
      activeProducts: inventory.active_products,
      lowStockProducts: inventory.low_stock_products,
      stockCostCents: inventory.stock_cost_cents,
    },
  };
}
