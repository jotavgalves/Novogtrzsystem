import { randomUUID } from 'node:crypto';

import { appendAudit } from './audit';
import type { DatabasePaymentMethod } from './operation-types';
import type { DatabaseTicketSale, DatabaseTicketSaleSource } from './ticket-model';
import {
  ensureUniqueTicketCodes,
  generateTicketCode,
  mapTicketSale,
  normalizeTicketCode,
  requireTicketEvent,
  requireTicketLot,
  requireTicketProduction,
  requireTicketSale,
} from './ticket-repository';
import type { DatabaseContext } from './types';

export function createTicketSale(
  database: DatabaseContext,
  input: {
    readonly lotId: string;
    readonly attendeeName: string;
    readonly source: DatabaseTicketSaleSource;
    readonly quantity: number;
    readonly paymentMethod?: DatabasePaymentMethod;
    readonly manualCodes?: readonly string[];
  },
): DatabaseTicketSale {
  requireTicketProduction(database);
  const eventId = requireTicketEvent(database);
  const lot = requireTicketLot(database, eventId, input.lotId);

  if (!lot.active) {
    throw new Error('O lote está inativo e não aceita novas vendas.');
  }

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error('A quantidade de ingressos deve ser positiva.');
  }

  if (lot.availableQuantity < input.quantity) {
    throw new Error(`Capacidade insuficiente. Disponível: ${String(lot.availableQuantity)}.`);
  }

  if (input.source === 'courtesy' && input.paymentMethod !== undefined) {
    throw new Error('Cortesias não possuem forma de pagamento.');
  }

  if (input.source !== 'courtesy' && input.paymentMethod === undefined) {
    throw new Error('Informe a forma de pagamento da venda.');
  }

  if (input.manualCodes !== undefined && input.manualCodes.length !== input.quantity) {
    throw new Error('A quantidade de códigos deve ser igual à quantidade de ingressos.');
  }

  const codes = (
    input.manualCodes ?? Array.from({ length: input.quantity }, generateTicketCode)
  ).map(normalizeTicketCode);
  ensureUniqueTicketCodes(database, eventId, codes);
  const saleId = randomUUID();
  const attendeeName = input.attendeeName.trim();
  const unitPriceCents = input.source === 'courtesy' ? 0 : lot.priceCents;
  const totalCents = unitPriceCents * input.quantity;
  const now = Date.now();

  database.sqlite.transaction(() => {
    database.sqlite
      .prepare(
        `INSERT INTO ticket_sales
         (id, event_id, lot_id, lot_name, attendee_name, source, quantity,
          unit_price_cents, total_cents, payment_method, status,
          created_at, cancelled_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, NULL, ?)`,
      )
      .run(
        saleId,
        eventId,
        lot.id,
        lot.name,
        attendeeName,
        input.source,
        input.quantity,
        unitPriceCents,
        totalCents,
        input.paymentMethod ?? null,
        now,
        now,
      );
    const insertCode = database.sqlite.prepare(
      `INSERT INTO ticket_codes (id, event_id, sale_id, code, status, created_at)
       VALUES (?, ?, ?, ?, 'valid', ?)`,
    );

    for (const code of codes) {
      insertCode.run(randomUUID(), eventId, saleId, code, now);
    }

    appendAudit(database, {
      action: input.source === 'courtesy' ? 'ticket.courtesy-created' : 'ticket.sale-created',
      entityType: 'ticket-sale',
      entityId: saleId,
      eventId,
      details: {
        attendeeName,
        codes,
        lotId: lot.id,
        paymentMethod: input.paymentMethod ?? null,
        quantity: input.quantity,
        source: input.source,
        totalCents,
      },
    });
  })();

  return mapTicketSale(database, requireTicketSale(database, saleId));
}

export function cancelTicketSale(
  database: DatabaseContext,
  input: { readonly saleId: string; readonly reason: string },
): DatabaseTicketSale {
  requireTicketProduction(database);
  const eventId = requireTicketEvent(database);
  const sale = requireTicketSale(database, input.saleId);

  if (sale.event_id !== eventId) {
    throw new Error('A venda não pertence ao evento ativo.');
  }

  if (sale.status === 'cancelled') {
    throw new Error('Esta venda de ingresso já foi cancelada.');
  }

  const reason = input.reason.trim();
  const now = Date.now();
  const correlationId = randomUUID();
  database.sqlite.transaction(() => {
    database.sqlite
      .prepare(
        `UPDATE ticket_sales
         SET status = 'cancelled', cancelled_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(now, now, sale.id);
    database.sqlite
      .prepare("UPDATE ticket_codes SET status = 'cancelled' WHERE sale_id = ?")
      .run(sale.id);
    appendAudit(database, {
      action: 'ticket.sale-cancelled',
      entityType: 'ticket-sale',
      entityId: sale.id,
      eventId,
      correlationId,
      details: {
        attendeeName: sale.attendee_name,
        quantity: sale.quantity,
        reason,
        totalCents: sale.total_cents,
      },
      before: { quantity: sale.quantity, status: sale.status, totalCents: sale.total_cents },
      after: { status: 'cancelled' },
      impact: { refundedCents: sale.total_cents, restoredUnits: sale.quantity },
    });
  })();

  return mapTicketSale(database, requireTicketSale(database, sale.id));
}

export function cancelTicketCode(
  database: DatabaseContext,
  input: { readonly codeId: string; readonly reason: string },
): DatabaseTicketSale {
  requireTicketProduction(database);
  const eventId = requireTicketEvent(database);
  const code = database.sqlite
    .prepare(
      `SELECT id, event_id, sale_id, code, status
       FROM ticket_codes
       WHERE id = ?`,
    )
    .get(input.codeId) as
    | {
        readonly id: string;
        readonly event_id: string;
        readonly sale_id: string;
        readonly code: string;
        readonly status: 'valid' | 'cancelled';
      }
    | undefined;

  if (code === undefined) {
    throw new Error('O ingresso informado não existe.');
  }

  if (code.event_id !== eventId) {
    throw new Error('O ingresso não pertence ao evento ativo.');
  }

  if (code.status === 'cancelled') {
    throw new Error('Este ingresso já foi cancelado.');
  }

  const sale = requireTicketSale(database, code.sale_id);

  if (sale.status === 'cancelled') {
    throw new Error('A venda deste ingresso já foi cancelada.');
  }

  const reason = input.reason.trim();
  const now = Date.now();
  const correlationId = randomUUID();
  database.sqlite.transaction(() => {
    database.sqlite
      .prepare("UPDATE ticket_codes SET status = 'cancelled' WHERE id = ?")
      .run(code.id);
    const activeCodes = database.sqlite
      .prepare(
        `SELECT COUNT(*) AS value
         FROM ticket_codes
         WHERE sale_id = ? AND status = 'valid'`,
      )
      .get(sale.id) as { readonly value: number };
    const nextStatus = activeCodes.value === 0 ? 'cancelled' : 'active';
    const nextTotalCents =
      sale.source === 'courtesy' ? 0 : sale.unit_price_cents * activeCodes.value;

    database.sqlite
      .prepare(
        `UPDATE ticket_sales
         SET quantity = ?,
             total_cents = ?,
             status = ?,
             cancelled_at = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(
        Math.max(activeCodes.value, 1),
        nextTotalCents,
        nextStatus,
        nextStatus === 'cancelled' ? now : null,
        now,
        sale.id,
      );
    appendAudit(database, {
      action: 'ticket.code-cancelled',
      entityType: 'ticket-code',
      entityId: code.id,
      eventId,
      correlationId,
      details: {
        code: code.code,
        lotId: sale.lot_id,
        reason,
        saleId: sale.id,
        unitPriceCents: sale.unit_price_cents,
      },
      before: {
        codeStatus: code.status,
        saleQuantity: sale.quantity,
        saleStatus: sale.status,
        saleTotalCents: sale.total_cents,
      },
      after: {
        codeStatus: 'cancelled',
        saleQuantity: Math.max(activeCodes.value, 1),
        saleStatus: nextStatus,
        saleTotalCents: nextTotalCents,
      },
      impact: {
        refundedCents: sale.source === 'courtesy' ? 0 : sale.unit_price_cents,
        restoredUnits: 1,
      },
    });
  })();

  return mapTicketSale(database, requireTicketSale(database, sale.id));
}
