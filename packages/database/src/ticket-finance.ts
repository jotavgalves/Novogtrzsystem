import type { DatabasePaymentMethod } from './operation-types';
import type { DatabaseContext } from './types';

interface TicketPaymentSummaryRow {
  readonly payment_method: DatabasePaymentMethod;
  readonly amount_cents: number;
}

export interface DatabaseTicketSalesByMethod {
  readonly cashCents: number;
  readonly pixCents: number;
  readonly creditCardCents: number;
  readonly debitCardCents: number;
}

export function getTicketSalesByMethod(
  database: DatabaseContext,
  eventId: string,
): DatabaseTicketSalesByMethod {
  const rows = database.sqlite
    .prepare(
      `SELECT payment_method, COALESCE(SUM(total_cents), 0) AS amount_cents
       FROM ticket_sales
       WHERE event_id = ? AND status = 'active' AND source != 'courtesy'
       GROUP BY payment_method`,
    )
    .all(eventId) as TicketPaymentSummaryRow[];
  let cashCents = 0;
  let pixCents = 0;
  let creditCardCents = 0;
  let debitCardCents = 0;

  for (const row of rows) {
    if (row.payment_method === 'cash') {
      cashCents = row.amount_cents;
    } else if (row.payment_method === 'pix') {
      pixCents = row.amount_cents;
    } else if (row.payment_method === 'credit-card') {
      creditCardCents = row.amount_cents;
    } else {
      debitCardCents = row.amount_cents;
    }
  }

  return { cashCents, pixCents, creditCardCents, debitCardCents };
}
