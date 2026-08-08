import { randomUUID } from 'node:crypto';

import { appendAudit } from './audit';
import { failDatabaseOperation } from './database-error';
import { requireOperationReason } from './operation-validation';
import {
  requireTicketEvent,
  requireTicketLot,
  requireTicketProduction,
  requireTicketSale,
} from './ticket-repository';
import type { DatabaseContext } from './types';

interface TicketCodeRow {
  readonly id: string;
  readonly event_id: string;
  readonly sale_id: string;
  readonly code: string;
  readonly status: 'valid' | 'cancelled';
  readonly created_at: number;
}

export function deleteTicketLot(
  database: DatabaseContext,
  input: { readonly lotId: string; readonly reason: string },
): { readonly success: true } {
  requireTicketProduction(database);
  const eventId = requireTicketEvent(database);
  const lot = requireTicketLot(database, eventId, input.lotId);
  const reason = requireOperationReason(input.reason);
  const sales = database.sqlite
    .prepare('SELECT COUNT(*) AS value FROM ticket_sales WHERE lot_id = ?')
    .get(lot.id) as { readonly value: number };

  if (sales.value > 0) {
    failDatabaseOperation(
      'CONFLICT',
      'Este lote possui vendas ou cortesias registradas. Exclua esses registros primeiro.',
      { lotId: lot.id, saleRecords: sales.value },
    );
  }

  database.sqlite.transaction(() => {
    database.sqlite.prepare('DELETE FROM ticket_lots WHERE id = ?').run(lot.id);
    appendAudit(database, {
      action: 'ticket.lot-deleted',
      entityType: 'ticket-lot',
      entityId: lot.id,
      eventId,
      correlationId: randomUUID(),
      details: { reason },
      before: lot,
      after: null,
      impact: { deletedPermanently: true },
    });
  })();

  return { success: true };
}

export function deleteTicketSale(
  database: DatabaseContext,
  input: { readonly saleId: string; readonly reason: string },
): { readonly success: true } {
  requireTicketProduction(database);
  const eventId = requireTicketEvent(database);
  const sale = requireTicketSale(database, input.saleId);
  const reason = requireOperationReason(input.reason);

  if (sale.event_id !== eventId) {
    failDatabaseOperation('INVALID_STATE', 'A venda não pertence ao evento ativo.', {
      saleId: sale.id,
      saleEventId: sale.event_id,
      activeEventId: eventId,
    });
  }

  if (sale.status !== 'cancelled') {
    failDatabaseOperation(
      'INVALID_STATE',
      'Cancele a venda antes de excluir definitivamente o registro.',
      { saleId: sale.id, status: sale.status, requiredStatus: 'cancelled' },
    );
  }

  const codes = database.sqlite
    .prepare(
      `SELECT id, event_id, sale_id, code, status, created_at
       FROM ticket_codes
       WHERE sale_id = ?
       ORDER BY created_at, id`,
    )
    .all(sale.id) as TicketCodeRow[];
  const correlationId = randomUUID();

  database.sqlite.transaction(() => {
    database.sqlite.prepare('DELETE FROM ticket_codes WHERE sale_id = ?').run(sale.id);
    database.sqlite.prepare('DELETE FROM ticket_sales WHERE id = ?').run(sale.id);
    appendAudit(database, {
      action: 'ticket.sale-deleted',
      entityType: 'ticket-sale',
      entityId: sale.id,
      eventId,
      correlationId,
      details: { reason },
      before: { sale, codes },
      after: null,
      impact: { deletedCodeRecords: codes.length, deletedPermanently: true },
    });
  })();

  return { success: true };
}

export function deleteTicketCode(
  database: DatabaseContext,
  input: { readonly codeId: string; readonly reason: string },
): { readonly success: true } {
  requireTicketProduction(database);
  const eventId = requireTicketEvent(database);
  const reason = requireOperationReason(input.reason);
  const code = database.sqlite
    .prepare(
      `SELECT id, event_id, sale_id, code, status, created_at
       FROM ticket_codes
       WHERE id = ?`,
    )
    .get(input.codeId) as TicketCodeRow | undefined;

  if (code === undefined) {
    failDatabaseOperation('NOT_FOUND', 'O ingresso informado não existe.', { codeId: input.codeId });
  }

  if (code.event_id !== eventId) {
    failDatabaseOperation('INVALID_STATE', 'O ingresso não pertence ao evento ativo.', {
      codeId: code.id,
      codeEventId: code.event_id,
      activeEventId: eventId,
    });
  }

  if (code.status !== 'cancelled') {
    failDatabaseOperation(
      'INVALID_STATE',
      'Cancele o ingresso antes de excluir definitivamente o código.',
      { codeId: code.id, status: code.status, requiredStatus: 'cancelled' },
    );
  }

  database.sqlite.transaction(() => {
    database.sqlite.prepare('DELETE FROM ticket_codes WHERE id = ?').run(code.id);
    appendAudit(database, {
      action: 'ticket.code-deleted',
      entityType: 'ticket-code',
      entityId: code.id,
      eventId,
      correlationId: randomUUID(),
      details: { reason, saleId: code.sale_id },
      before: code,
      after: null,
      impact: { deletedPermanently: true },
    });
  })();

  return { success: true };
}
