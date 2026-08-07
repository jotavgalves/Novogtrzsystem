import { getCashState, type DatabaseCashState } from './cash';
import { getSessionState } from './control';
import type { DatabaseContext } from './types';

export interface DatabaseEventCloseSummary {
  readonly eventId: string;
  readonly eventName: string;
  readonly generatedAt: number;
  readonly openOrdersCount: number;
  readonly paidOrdersCount: number;
  readonly cancelledOrdersCount: number;
  readonly cashStatus: 'missing' | 'open' | 'closed';
  readonly requiresCashCount: boolean;
  readonly expectedCashCents: number;
  readonly countedCashCents: number | null;
  readonly varianceCents: number | null;
  readonly salesByMethod: DatabaseCashState['salesByMethod'];
  readonly grossSalesCents: number;
  readonly activeExpensesCents: number;
  readonly projectedResultCents: number;
  readonly ticketSalesCount: number;
  readonly ticketSoldQuantity: number;
  readonly ticketCourtesyQuantity: number;
  readonly ticketRevenueCents: number;
  readonly voucherCount: number;
  readonly vouchersIssuedCents: number;
  readonly vouchersRemainingCents: number;
  readonly blockers: readonly string[];
  readonly canClose: boolean;
}

interface EventRow {
  readonly id: string;
  readonly name: string;
  readonly status: 'open' | 'closed' | 'archived';
}

interface OrderSummaryRow {
  readonly open_count: number;
  readonly paid_count: number;
  readonly cancelled_count: number;
}

interface TicketSummaryRow {
  readonly sale_count: number;
  readonly sold_quantity: number;
  readonly courtesy_quantity: number;
  readonly revenue_cents: number;
}

interface VoucherSummaryRow {
  readonly voucher_count: number;
  readonly issued_cents: number;
  readonly remaining_cents: number;
}

function requireProductionAndActiveEvent(database: DatabaseContext, eventId: string): EventRow {
  const session = getSessionState(database);

  if (session.profile !== 'production') {
    throw new Error('O encerramento do evento exige o perfil Produção.');
  }

  if (session.activeEvent?.id !== eventId) {
    throw new Error('Selecione o evento antes de iniciar o encerramento.');
  }

  const event = database.sqlite
    .prepare('SELECT id, name, status FROM events WHERE id = ?')
    .get(eventId) as EventRow | undefined;

  if (event?.status !== 'open') {
    throw new Error('Somente eventos abertos podem ser encerrados.');
  }

  return event;
}

function getOrderSummary(database: DatabaseContext, eventId: string): OrderSummaryRow {
  return database.sqlite
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END), 0) AS open_count,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END), 0) AS paid_count,
         COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0)
           AS cancelled_count
       FROM orders
       WHERE event_id = ?`,
    )
    .get(eventId) as OrderSummaryRow;
}

function getTicketSummary(database: DatabaseContext, eventId: string): TicketSummaryRow {
  return database.sqlite
    .prepare(
      `SELECT
         COUNT(*) AS sale_count,
         COALESCE(SUM(CASE WHEN source != 'courtesy' THEN quantity ELSE 0 END), 0)
           AS sold_quantity,
         COALESCE(SUM(CASE WHEN source = 'courtesy' THEN quantity ELSE 0 END), 0)
           AS courtesy_quantity,
         COALESCE(SUM(total_cents), 0) AS revenue_cents
       FROM ticket_sales
       WHERE event_id = ? AND status = 'active'`,
    )
    .get(eventId) as TicketSummaryRow;
}

function getVoucherSummary(database: DatabaseContext, eventId: string): VoucherSummaryRow {
  return database.sqlite
    .prepare(
      `SELECT
         COUNT(*) AS voucher_count,
         COALESCE(SUM(initial_balance_cents), 0) AS issued_cents,
         COALESCE(SUM(remaining_balance_cents), 0) AS remaining_cents
       FROM vouchers
       WHERE event_id = ?`,
    )
    .get(eventId) as VoucherSummaryRow;
}

export function previewEventClose(
  database: DatabaseContext,
  eventId: string,
): DatabaseEventCloseSummary {
  const event = requireProductionAndActiveEvent(database, eventId);
  const orders = getOrderSummary(database, eventId);
  const tickets = getTicketSummary(database, eventId);
  const vouchers = getVoucherSummary(database, eventId);
  const cash = getCashState(database);
  const cashStatus = cash.register?.status ?? 'missing';
  const blockers: string[] = [];

  if (orders.open_count > 0) {
    blockers.push(`Existem ${String(orders.open_count)} comandas abertas.`);
  }

  if (
    cash.register === null &&
    (cash.grossSalesCents > 0 || cash.activeExpensesCents > 0 || tickets.revenue_cents > 0)
  ) {
    blockers.push(
      'Abra e concilie o caixa antes de encerrar um evento com movimentação financeira.',
    );
  }

  return {
    eventId,
    eventName: event.name,
    generatedAt: Date.now(),
    openOrdersCount: orders.open_count,
    paidOrdersCount: orders.paid_count,
    cancelledOrdersCount: orders.cancelled_count,
    cashStatus,
    requiresCashCount: cashStatus === 'open',
    expectedCashCents: cash.expectedCashCents,
    countedCashCents: cash.register?.countedCashCents ?? null,
    varianceCents: cash.register?.varianceCents ?? null,
    salesByMethod: cash.salesByMethod,
    grossSalesCents: cash.grossSalesCents,
    activeExpensesCents: cash.activeExpensesCents,
    projectedResultCents: cash.projectedResultCents,
    ticketSalesCount: tickets.sale_count,
    ticketSoldQuantity: tickets.sold_quantity,
    ticketCourtesyQuantity: tickets.courtesy_quantity,
    ticketRevenueCents: tickets.revenue_cents,
    voucherCount: vouchers.voucher_count,
    vouchersIssuedCents: vouchers.issued_cents,
    vouchersRemainingCents: vouchers.remaining_cents,
    blockers,
    canClose: blockers.length === 0,
  };
}
