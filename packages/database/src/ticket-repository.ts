import { randomBytes } from 'node:crypto';

import { getSessionState } from './control';
import type {
  DatabaseTicketCode,
  DatabaseTicketLot,
  DatabaseTicketSale,
  DatabaseTicketState,
  TicketCodeRow,
  TicketLotRow,
  TicketSaleRow,
} from './ticket-model';
import type { DatabaseContext } from './types';

export function requireTicketProduction(database: DatabaseContext): void {
  if (getSessionState(database).profile !== 'production') {
    throw new Error('A administração de ingressos exige o perfil Produção.');
  }
}

export function requireTicketEvent(database: DatabaseContext): string {
  const eventId = getSessionState(database).activeEvent?.id;

  if (eventId === undefined) {
    throw new Error('Selecione um evento aberto antes de administrar ingressos.');
  }

  return eventId;
}

function mapLot(row: TicketLotRow): DatabaseTicketLot {
  const consumed = row.sold_quantity + row.courtesy_quantity;
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    priceCents: row.price_cents,
    capacity: row.capacity,
    soldQuantity: row.sold_quantity,
    courtesyQuantity: row.courtesy_quantity,
    availableQuantity: Math.max(row.capacity - consumed, 0),
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCode(row: TicketCodeRow): DatabaseTicketCode {
  return {
    id: row.id,
    saleId: row.sale_id,
    code: row.code,
    status: row.status,
    createdAt: row.created_at,
  };
}

function listCodes(database: DatabaseContext, saleId: string): readonly DatabaseTicketCode[] {
  const rows = database.sqlite
    .prepare(
      `SELECT id, sale_id, code, status, created_at
       FROM ticket_codes
       WHERE sale_id = ?
       ORDER BY created_at, code COLLATE NOCASE`,
    )
    .all(saleId) as TicketCodeRow[];
  return rows.map(mapCode);
}

export function mapTicketSale(database: DatabaseContext, row: TicketSaleRow): DatabaseTicketSale {
  return {
    id: row.id,
    eventId: row.event_id,
    lotId: row.lot_id,
    lotName: row.lot_name,
    attendeeName: row.attendee_name,
    source: row.source,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    totalCents: row.total_cents,
    paymentMethod: row.payment_method,
    status: row.status,
    codes: listCodes(database, row.id),
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
    updatedAt: row.updated_at,
  };
}

function listTicketLots(database: DatabaseContext, eventId: string): readonly DatabaseTicketLot[] {
  const rows = database.sqlite
    .prepare(
      `SELECT
         tl.id,
         tl.event_id,
         tl.name,
         tl.price_cents,
         tl.capacity,
         tl.active,
         COALESCE(SUM(CASE
           WHEN ts.status = 'active' AND ts.source != 'courtesy' THEN ts.quantity ELSE 0 END), 0)
           AS sold_quantity,
         COALESCE(SUM(CASE
           WHEN ts.status = 'active' AND ts.source = 'courtesy' THEN ts.quantity ELSE 0 END), 0)
           AS courtesy_quantity,
         tl.created_at,
         tl.updated_at
       FROM ticket_lots tl
       LEFT JOIN ticket_sales ts ON ts.lot_id = tl.id
       WHERE tl.event_id = ?
       GROUP BY tl.id
       ORDER BY tl.active DESC, tl.created_at, tl.name COLLATE NOCASE`,
    )
    .all(eventId) as TicketLotRow[];
  return rows.map(mapLot);
}

function listTicketSales(
  database: DatabaseContext,
  eventId: string,
): readonly DatabaseTicketSale[] {
  const rows = database.sqlite
    .prepare(
      `SELECT id, event_id, lot_id, lot_name, attendee_name, source, quantity,
              unit_price_cents, total_cents, payment_method, status, created_at,
              cancelled_at, updated_at
       FROM ticket_sales
       WHERE event_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 200`,
    )
    .all(eventId) as TicketSaleRow[];
  return rows.map((row) => mapTicketSale(database, row));
}

export function requireTicketLot(
  database: DatabaseContext,
  eventId: string,
  lotId: string,
): DatabaseTicketLot {
  const lot = listTicketLots(database, eventId).find((candidate) => candidate.id === lotId);

  if (lot === undefined) {
    throw new Error('O lote informado não existe no evento ativo.');
  }

  return lot;
}

export function requireTicketSale(database: DatabaseContext, saleId: string): TicketSaleRow {
  const row = database.sqlite
    .prepare(
      `SELECT id, event_id, lot_id, lot_name, attendee_name, source, quantity,
              unit_price_cents, total_cents, payment_method, status, created_at,
              cancelled_at, updated_at
       FROM ticket_sales WHERE id = ?`,
    )
    .get(saleId) as TicketSaleRow | undefined;

  if (row === undefined) {
    throw new Error('A venda de ingresso informada não existe.');
  }

  return row;
}

export function requireUniqueTicketLotName(
  database: DatabaseContext,
  eventId: string,
  name: string,
  excludedId?: string,
): void {
  const duplicate = database.sqlite
    .prepare(
      `SELECT id FROM ticket_lots
       WHERE event_id = ? AND name = ? COLLATE NOCASE
         AND (? IS NULL OR id != ?)`,
    )
    .get(eventId, name, excludedId ?? null, excludedId ?? null);

  if (duplicate !== undefined) {
    throw new Error('Já existe um lote com esse nome no evento.');
  }
}

export function normalizeTicketCode(code: string): string {
  return code.trim().toLocaleUpperCase('pt-BR').replaceAll(/\s+/gu, '-');
}

export function generateTicketCode(): string {
  return `TKT-${randomBytes(6).toString('hex').toLocaleUpperCase('pt-BR')}`;
}

export function ensureUniqueTicketCodes(
  database: DatabaseContext,
  eventId: string,
  codes: readonly string[],
): void {
  if (new Set(codes).size !== codes.length) {
    throw new Error('Os códigos da venda precisam ser únicos.');
  }

  const findCode = database.sqlite.prepare(
    'SELECT id FROM ticket_codes WHERE event_id = ? AND code = ? COLLATE NOCASE',
  );

  for (const code of codes) {
    if (findCode.get(eventId, code) !== undefined) {
      throw new Error(`O código ${code} já foi utilizado neste evento.`);
    }
  }
}

export function getTicketState(database: DatabaseContext): DatabaseTicketState {
  const eventId = getSessionState(database).activeEvent?.id ?? null;

  if (eventId === null) {
    return { activeEventId: null, lots: [], sales: [], activeRevenueCents: 0 };
  }

  const sales = listTicketSales(database, eventId);
  return {
    activeEventId: eventId,
    lots: listTicketLots(database, eventId),
    sales,
    activeRevenueCents: sales
      .filter((sale) => sale.status === 'active')
      .reduce((total, sale) => total + sale.totalCents, 0),
  };
}
