import { randomUUID } from 'node:crypto';

import { appendAudit } from './audit';
import { getSessionState } from './control';
import type { DatabaseContext } from './types';

export interface DatabaseTransferStockInput {
  readonly productId: string;
  readonly sourceEventId: string;
  readonly destinationEventId: string;
  readonly quantity: number;
  readonly note?: string;
}

export interface DatabaseStockTransfer {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly sourceEventId: string;
  readonly sourceEventName: string;
  readonly destinationEventId: string;
  readonly destinationEventName: string;
  readonly quantity: number;
  readonly note: string | null;
  readonly sourceQuantityBefore: number;
  readonly sourceQuantityAfter: number;
  readonly destinationQuantityBefore: number;
  readonly destinationQuantityAfter: number;
  readonly createdAt: number;
}

interface EventRow {
  readonly id: string;
  readonly name: string;
  readonly status: 'open' | 'closed' | 'archived';
}

interface ProductRow {
  readonly id: string;
  readonly name: string;
}

interface StockRow {
  readonly quantity: number;
}

interface TransferRow {
  readonly id: string;
  readonly product_id: string;
  readonly product_name: string;
  readonly source_event_id: string;
  readonly source_event_name: string;
  readonly destination_event_id: string;
  readonly destination_event_name: string;
  readonly quantity: number;
  readonly note: string | null;
  readonly source_quantity_before: number;
  readonly source_quantity_after: number;
  readonly destination_quantity_before: number;
  readonly destination_quantity_after: number;
  readonly created_at: number;
}

function requireProduction(database: DatabaseContext): void {
  if (getSessionState(database).profile !== 'production') {
    throw new Error('Transferências de estoque exigem o perfil Produção.');
  }
}

function requireEvent(database: DatabaseContext, eventId: string): EventRow {
  const event = database.sqlite
    .prepare('SELECT id, name, status FROM events WHERE id = ?')
    .get(eventId) as EventRow | undefined;

  if (event === undefined) {
    throw new Error('Um dos eventos informados não existe.');
  }

  return event;
}

function requireProduct(database: DatabaseContext, productId: string): ProductRow {
  const product = database.sqlite
    .prepare('SELECT id, name FROM products WHERE id = ?')
    .get(productId) as ProductRow | undefined;

  if (product === undefined) {
    throw new Error('O produto informado não existe.');
  }

  return product;
}

function getStockQuantity(database: DatabaseContext, eventId: string, productId: string): number {
  const row = database.sqlite
    .prepare('SELECT quantity FROM event_stock WHERE event_id = ? AND product_id = ?')
    .get(eventId, productId) as StockRow | undefined;
  return row?.quantity ?? 0;
}

function upsertStock(
  database: DatabaseContext,
  eventId: string,
  productId: string,
  quantity: number,
  updatedAt: number,
): void {
  database.sqlite
    .prepare(
      `INSERT INTO event_stock (event_id, product_id, quantity, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(event_id, product_id)
       DO UPDATE SET quantity = excluded.quantity, updated_at = excluded.updated_at`,
    )
    .run(eventId, productId, quantity, updatedAt);
}

function mapTransfer(row: TransferRow): DatabaseStockTransfer {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    sourceEventId: row.source_event_id,
    sourceEventName: row.source_event_name,
    destinationEventId: row.destination_event_id,
    destinationEventName: row.destination_event_name,
    quantity: row.quantity,
    note: row.note,
    sourceQuantityBefore: row.source_quantity_before,
    sourceQuantityAfter: row.source_quantity_after,
    destinationQuantityBefore: row.destination_quantity_before,
    destinationQuantityAfter: row.destination_quantity_after,
    createdAt: row.created_at,
  };
}

function requireTransfer(database: DatabaseContext, transferId: string): DatabaseStockTransfer {
  const row = database.sqlite
    .prepare(
      `SELECT
         id,
         product_id,
         product_name,
         source_event_id,
         source_event_name,
         destination_event_id,
         destination_event_name,
         quantity,
         note,
         source_quantity_before,
         source_quantity_after,
         destination_quantity_before,
         destination_quantity_after,
         created_at
       FROM stock_transfers
       WHERE id = ?`,
    )
    .get(transferId) as TransferRow | undefined;

  if (row === undefined) {
    throw new Error('A transferência registrada não foi encontrada.');
  }

  return mapTransfer(row);
}

export function listStockTransfers(database: DatabaseContext): readonly DatabaseStockTransfer[] {
  requireProduction(database);
  const rows = database.sqlite
    .prepare(
      `SELECT
         id,
         product_id,
         product_name,
         source_event_id,
         source_event_name,
         destination_event_id,
         destination_event_name,
         quantity,
         note,
         source_quantity_before,
         source_quantity_after,
         destination_quantity_before,
         destination_quantity_after,
         created_at
       FROM stock_transfers
       ORDER BY created_at DESC, rowid DESC
       LIMIT 100`,
    )
    .all() as TransferRow[];
  return rows.map(mapTransfer);
}

export function transferStockBetweenEvents(
  database: DatabaseContext,
  input: DatabaseTransferStockInput,
): DatabaseStockTransfer {
  requireProduction(database);

  if (input.sourceEventId === input.destinationEventId) {
    throw new Error('Os eventos de origem e destino devem ser diferentes.');
  }

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error('A quantidade transferida deve ser um número inteiro positivo.');
  }

  const sourceEvent = requireEvent(database, input.sourceEventId);
  const destinationEvent = requireEvent(database, input.destinationEventId);
  const product = requireProduct(database, input.productId);

  if (sourceEvent.status === 'archived') {
    throw new Error('Não é possível retirar estoque de um evento arquivado.');
  }

  if (destinationEvent.status !== 'open') {
    throw new Error('O evento de destino precisa estar aberto.');
  }

  const sourceQuantityBefore = getStockQuantity(database, sourceEvent.id, product.id);
  const destinationQuantityBefore = getStockQuantity(database, destinationEvent.id, product.id);

  if (sourceQuantityBefore < input.quantity) {
    throw new Error(
      `Estoque insuficiente na origem. Saldo atual: ${String(sourceQuantityBefore)}.`,
    );
  }

  const sourceQuantityAfter = sourceQuantityBefore - input.quantity;
  const destinationQuantityAfter = destinationQuantityBefore + input.quantity;
  const transferId = randomUUID();
  const createdAt = Date.now();
  const trimmedNote = input.note?.trim();
  const note = trimmedNote === undefined || trimmedNote.length === 0 ? null : trimmedNote;

  database.sqlite.transaction(() => {
    upsertStock(database, sourceEvent.id, product.id, sourceQuantityAfter, createdAt);
    upsertStock(database, destinationEvent.id, product.id, destinationQuantityAfter, createdAt);
    database.sqlite
      .prepare(
        `INSERT INTO stock_transfers
         (id, product_id, product_name, source_event_id, source_event_name,
          destination_event_id, destination_event_name, quantity, note,
          source_quantity_before, source_quantity_after,
          destination_quantity_before, destination_quantity_after, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        transferId,
        product.id,
        product.name,
        sourceEvent.id,
        sourceEvent.name,
        destinationEvent.id,
        destinationEvent.name,
        input.quantity,
        note,
        sourceQuantityBefore,
        sourceQuantityAfter,
        destinationQuantityBefore,
        destinationQuantityAfter,
        createdAt,
      );

    const commonDetails = {
      destinationEventId: destinationEvent.id,
      destinationEventName: destinationEvent.name,
      destinationQuantityAfter,
      destinationQuantityBefore,
      note,
      productId: product.id,
      productName: product.name,
      quantity: input.quantity,
      sourceEventId: sourceEvent.id,
      sourceEventName: sourceEvent.name,
      sourceQuantityAfter,
      sourceQuantityBefore,
    };

    appendAudit(database, {
      action: 'inventory.stock-transfer-out',
      entityType: 'stock-transfer',
      entityId: transferId,
      eventId: sourceEvent.id,
      details: commonDetails,
    });
    appendAudit(database, {
      action: 'inventory.stock-transfer-in',
      entityType: 'stock-transfer',
      entityId: transferId,
      eventId: destinationEvent.id,
      details: commonDetails,
    });
  })();

  return requireTransfer(database, transferId);
}
