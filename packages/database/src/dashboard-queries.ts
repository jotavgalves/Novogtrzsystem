import type { DatabaseContext } from './types';

export interface DatabaseInventoryBreakEvenItem {
  readonly productId: string;
  readonly productName: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly purchasedUnits: number;
  readonly purchaseCostCents: number;
  readonly salePriceCents: number;
  readonly soldUnits: number;
  readonly currentStockUnits: number;
  readonly breakEvenUnits: number | null;
  readonly remainingUnitsToBreakEven: number | null;
}

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
    readonly potentialRevenueCents: number;
    readonly potentialGrossProfitCents: number;
  };
  readonly inventoryBreakEven: readonly DatabaseInventoryBreakEvenItem[];
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
  readonly potential_revenue_cents: number;
}

interface InventoryBreakEvenRow {
  readonly product_id: string;
  readonly product_name: string;
  readonly category_id: string;
  readonly category_name: string;
  readonly purchased_units: number;
  readonly purchase_cost_cents: number;
  readonly sale_price_cents: number;
  readonly sold_units: number;
  readonly current_stock_units: number;
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

function listInventoryBreakEven(
  database: DatabaseContext,
  eventId: string,
): readonly DatabaseInventoryBreakEvenItem[] {
  const rows = database.sqlite
    .prepare(
      `SELECT
         p.id AS product_id,
         p.name AS product_name,
         pc.id AS category_id,
         pc.name AS category_name,
         COALESCE(purchases.purchased_units, 0) AS purchased_units,
         COALESCE(purchases.purchased_units, 0) * p.cost_cents AS purchase_cost_cents,
         p.sale_price_cents,
         COALESCE(sales.sold_units, 0) AS sold_units,
         COALESCE(es.quantity, 0) AS current_stock_units
       FROM products p
       INNER JOIN product_categories pc ON pc.id = p.category_id
       LEFT JOIN event_stock es ON es.event_id = ? AND es.product_id = p.id
       LEFT JOIN (
         SELECT product_id, SUM(quantity) AS purchased_units
         FROM stock_movements
         WHERE event_id = ? AND type = 'purchase'
         GROUP BY product_id
       ) purchases ON purchases.product_id = p.id
       LEFT JOIN (
         SELECT
           product_id,
           SUM(CASE WHEN type = 'sale' THEN quantity WHEN type = 'return' THEN -quantity ELSE 0 END)
             AS sold_units
         FROM stock_movements
         WHERE event_id = ? AND type IN ('sale', 'return')
         GROUP BY product_id
       ) sales ON sales.product_id = p.id
       WHERE p.active = 1
          OR COALESCE(purchases.purchased_units, 0) > 0
          OR COALESCE(es.quantity, 0) > 0
       ORDER BY pc.name COLLATE NOCASE, p.name COLLATE NOCASE`,
    )
    .all(eventId, eventId, eventId) as InventoryBreakEvenRow[];

  return rows.map((row) => {
    const purchasedUnits = Math.max(row.purchased_units, 0);
    const purchaseCostCents = Math.max(row.purchase_cost_cents, 0);
    const soldUnits = Math.max(row.sold_units, 0);
    const breakEvenUnits =
      purchaseCostCents === 0
        ? 0
        : row.sale_price_cents > 0
          ? Math.ceil(purchaseCostCents / row.sale_price_cents)
          : null;

    return {
      productId: row.product_id,
      productName: row.product_name,
      categoryId: row.category_id,
      categoryName: row.category_name,
      purchasedUnits,
      purchaseCostCents,
      salePriceCents: row.sale_price_cents,
      soldUnits,
      currentStockUnits: Math.max(row.current_stock_units, 0),
      breakEvenUnits,
      remainingUnitsToBreakEven:
        breakEvenUnits === null ? null : Math.max(breakEvenUnits - soldUnits, 0),
    };
  });
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
         COALESCE(SUM(COALESCE(es.quantity, 0) * p.cost_cents), 0) AS stock_cost_cents,
         COALESCE(SUM(
           CASE WHEN p.active = 1 THEN COALESCE(es.quantity, 0) * p.sale_price_cents ELSE 0 END
         ), 0) AS potential_revenue_cents
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
      potentialRevenueCents: inventory.potential_revenue_cents,
      potentialGrossProfitCents: inventory.potential_revenue_cents - inventory.stock_cost_cents,
    },
    inventoryBreakEven: listInventoryBreakEven(database, eventId),
  };
}
