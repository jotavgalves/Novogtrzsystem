import type { DatabasePaymentMethod } from './operation-types';
import type { DatabaseContext } from './types';

interface VoucherImpactOrderRow {
  readonly order_id: string;
  readonly order_total_cents: number;
  readonly voucher_cents: number;
}

export interface DatabaseVoucherDeletePaymentImpact {
  readonly id: string;
  readonly orderId: string;
  readonly method: DatabasePaymentMethod;
  readonly amountCents: number;
  readonly receivedCents: number | null;
  readonly changeCents: number;
}

export interface DatabaseVoucherDeleteStockImpact {
  readonly productId: string;
  readonly productName: string;
  readonly quantity: number;
}

export interface DatabaseVoucherDeleteFinancialImpact {
  readonly affectedRevenueCents: number;
  readonly nonVoucherPaymentCents: number;
  readonly voucherRefundCents: number;
  readonly paymentRecordCount: number;
  readonly voucherRedemptionRecordCount: number;
}

interface VoucherDeleteImpact {
  readonly openAllocations: number;
  readonly paidOrders: readonly VoucherImpactOrderRow[];
  readonly affectedPayments: readonly DatabaseVoucherDeletePaymentImpact[];
  readonly stockReturns: readonly DatabaseVoucherDeleteStockImpact[];
  readonly financialImpact: DatabaseVoucherDeleteFinancialImpact;
}

interface PaymentImpactRow {
  readonly id: string;
  readonly order_id: string;
  readonly method: DatabasePaymentMethod;
  readonly amount_cents: number;
  readonly received_cents: number | null;
  readonly change_cents: number;
}

interface StockImpactRow {
  readonly product_id: string;
  readonly product_name: string;
  readonly quantity: number;
}

function placeholders(values: readonly string[]): string {
  return values.map(() => '?').join(', ');
}

function listPayments(
  database: DatabaseContext,
  orderIds: readonly string[],
): readonly DatabaseVoucherDeletePaymentImpact[] {
  if (orderIds.length === 0) {
    return [];
  }

  const rows = database.sqlite
    .prepare(
      `SELECT p.id, p.order_id, p.method, p.amount_cents, p.received_cents, p.change_cents
       FROM payments p
       WHERE p.order_id IN (${placeholders(orderIds)})
       ORDER BY p.created_at, p.id`,
    )
    .all(...orderIds) as PaymentImpactRow[];

  return rows.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    method: row.method,
    amountCents: row.amount_cents,
    receivedCents: row.received_cents,
    changeCents: row.change_cents,
  }));
}

function listStockReturns(
  database: DatabaseContext,
  orderIds: readonly string[],
): readonly DatabaseVoucherDeleteStockImpact[] {
  if (orderIds.length === 0) {
    return [];
  }

  const saleNotes = orderIds.map((orderId) => `Venda da comanda ${orderId}`);
  const rows = database.sqlite
    .prepare(
      `SELECT sm.product_id, p.name AS product_name, SUM(sm.quantity) AS quantity
       FROM stock_movements sm
       INNER JOIN products p ON p.id = sm.product_id
       WHERE sm.type = 'sale' AND sm.note IN (${placeholders(saleNotes)})
       GROUP BY sm.product_id, p.name
       ORDER BY p.name COLLATE NOCASE`,
    )
    .all(...saleNotes) as StockImpactRow[];

  return rows.map((row) => ({
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
  }));
}

export function calculateVoucherDeleteImpact(
  database: DatabaseContext,
  voucherId: string,
): VoucherDeleteImpact {
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
  const orderIds = paidOrders.map((order) => order.order_id);
  const affectedPayments = listPayments(database, orderIds);
  const stockReturns = listStockReturns(database, orderIds);
  const affectedRevenueCents = paidOrders.reduce(
    (total, order) => total + order.order_total_cents,
    0,
  );
  const voucherRefundCents = paidOrders.reduce((total, order) => total + order.voucher_cents, 0);
  const nonVoucherPaymentCents = affectedPayments.reduce(
    (total, payment) => total + payment.amountCents,
    0,
  );

  return {
    openAllocations: openAllocations.value,
    paidOrders,
    affectedPayments,
    stockReturns,
    financialImpact: {
      affectedRevenueCents,
      nonVoucherPaymentCents,
      voucherRefundCents,
      paymentRecordCount: affectedPayments.length,
      voucherRedemptionRecordCount: paidOrders.length,
    },
  };
}
