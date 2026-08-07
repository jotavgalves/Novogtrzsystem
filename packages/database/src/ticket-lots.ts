import { randomUUID } from 'node:crypto';

import { appendAudit } from './audit';
import type { DatabaseTicketLot } from './ticket-model';
import {
  requireTicketEvent,
  requireTicketLot,
  requireTicketProduction,
  requireUniqueTicketLotName,
} from './ticket-repository';
import type { DatabaseContext } from './types';

export function createTicketLot(
  database: DatabaseContext,
  input: { readonly name: string; readonly priceCents: number; readonly capacity: number },
): DatabaseTicketLot {
  requireTicketProduction(database);
  const eventId = requireTicketEvent(database);
  const name = input.name.trim();
  requireUniqueTicketLotName(database, eventId, name);

  if (!Number.isInteger(input.priceCents) || input.priceCents < 0) {
    throw new Error('O preço do lote deve ser um inteiro não negativo.');
  }

  if (!Number.isInteger(input.capacity) || input.capacity <= 0) {
    throw new Error('A capacidade do lote deve ser positiva.');
  }

  const lotId = randomUUID();
  const now = Date.now();
  database.sqlite.transaction(() => {
    database.sqlite
      .prepare(
        `INSERT INTO ticket_lots
         (id, event_id, name, price_cents, capacity, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(lotId, eventId, name, input.priceCents, input.capacity, now, now);
    appendAudit(database, {
      action: 'ticket.lot-created',
      entityType: 'ticket-lot',
      entityId: lotId,
      eventId,
      details: { capacity: input.capacity, name, priceCents: input.priceCents },
    });
  })();

  return requireTicketLot(database, eventId, lotId);
}

export function updateTicketLot(
  database: DatabaseContext,
  input: {
    readonly lotId: string;
    readonly name: string;
    readonly priceCents: number;
    readonly capacity: number;
    readonly active: boolean;
  },
): DatabaseTicketLot {
  requireTicketProduction(database);
  const eventId = requireTicketEvent(database);
  const before = requireTicketLot(database, eventId, input.lotId);
  const name = input.name.trim();
  requireUniqueTicketLotName(database, eventId, name, input.lotId);
  const consumed = before.soldQuantity + before.courtesyQuantity;

  if (!Number.isInteger(input.capacity) || input.capacity < consumed) {
    throw new Error(`A capacidade não pode ser menor que os ${String(consumed)} ingressos ativos.`);
  }

  if (!Number.isInteger(input.priceCents) || input.priceCents < 0) {
    throw new Error('O preço do lote deve ser um inteiro não negativo.');
  }

  const now = Date.now();
  database.sqlite.transaction(() => {
    database.sqlite
      .prepare(
        `UPDATE ticket_lots
         SET name = ?, price_cents = ?, capacity = ?, active = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(name, input.priceCents, input.capacity, input.active ? 1 : 0, now, input.lotId);
    appendAudit(database, {
      action: 'ticket.lot-updated',
      entityType: 'ticket-lot',
      entityId: input.lotId,
      eventId,
      details: { after: { ...input, name }, before },
    });
  })();

  return requireTicketLot(database, eventId, input.lotId);
}
