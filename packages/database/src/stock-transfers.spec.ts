import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  changeEventStatus,
  createEvent,
  createInventoryProduct,
  createProductCategory,
  listStockTransfers,
  openDatabase,
  recordStockMovement,
  setActiveEvent,
  switchProfile,
  transferStockBetweenEvents,
  type DatabaseContext,
} from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-transfers-'));
  return openDatabase(path.join(temporaryDirectory, 'transfers.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

function createProduct(database: DatabaseContext): string {
  const category = createProductCategory(database, 'Transferíveis');
  return createInventoryProduct(database, {
    categoryId: category.id,
    name: 'Água mineral',
    kind: 'drink',
    costCents: 200,
    salePriceCents: 500,
    lowStockThreshold: 2,
  }).id;
}

function getQuantity(database: DatabaseContext, eventId: string, productId: string): number {
  const row = database.sqlite
    .prepare('SELECT quantity FROM event_stock WHERE event_id = ? AND product_id = ?')
    .get(eventId, productId) as { readonly quantity: number } | undefined;
  return row?.quantity ?? 0;
}

describe('stock transfers database', () => {
  it('debita e credita na mesma transação e grava snapshots imutáveis', async () => {
    const database = await createTemporaryDatabase();
    const source = createEvent(database, { name: 'Evento origem', startsAt: Date.now() });
    const productId = createProduct(database);
    recordStockMovement(database, { productId, type: 'purchase', quantity: 10 });
    const destination = createEvent(database, {
      name: 'Evento destino',
      startsAt: Date.now() + 86_400_000,
    });

    const transfer = transferStockBetweenEvents(database, {
      productId,
      sourceEventId: source.id,
      destinationEventId: destination.id,
      quantity: 4,
      note: 'Saldo remanescente',
    });

    expect(transfer).toMatchObject({
      productName: 'Água mineral',
      sourceEventName: 'Evento origem',
      destinationEventName: 'Evento destino',
      sourceQuantityBefore: 10,
      sourceQuantityAfter: 6,
      destinationQuantityBefore: 0,
      destinationQuantityAfter: 4,
      note: 'Saldo remanescente',
    });
    expect(getQuantity(database, source.id, productId)).toBe(6);
    expect(getQuantity(database, destination.id, productId)).toBe(4);
    expect(listStockTransfers(database)).toEqual([transfer]);

    const auditRows = database.sqlite
      .prepare(
        `SELECT event_id, action
         FROM audit_log
         WHERE entity_id = ?
         ORDER BY id`,
      )
      .all(transfer.id);
    expect(auditRows).toEqual([
      { event_id: source.id, action: 'inventory.stock-transfer-out' },
      { event_id: destination.id, action: 'inventory.stock-transfer-in' },
    ]);
    database.close();
  });

  it('preserva ambos os saldos quando a origem não possui quantidade suficiente', async () => {
    const database = await createTemporaryDatabase();
    const source = createEvent(database, { name: 'Origem insuficiente', startsAt: Date.now() });
    const productId = createProduct(database);
    recordStockMovement(database, { productId, type: 'purchase', quantity: 3 });
    const destination = createEvent(database, {
      name: 'Destino intacto',
      startsAt: Date.now() + 86_400_000,
    });

    expect(() =>
      transferStockBetweenEvents(database, {
        productId,
        sourceEventId: source.id,
        destinationEventId: destination.id,
        quantity: 4,
      }),
    ).toThrow('Estoque insuficiente na origem. Saldo atual: 3.');
    expect(getQuantity(database, source.id, productId)).toBe(3);
    expect(getQuantity(database, destination.id, productId)).toBe(0);
    expect(listStockTransfers(database)).toHaveLength(0);
    database.close();
  });

  it('permite origem encerrada, mas bloqueia origem arquivada e destino fechado', async () => {
    const database = await createTemporaryDatabase();
    const source = createEvent(database, { name: 'Evento encerrado', startsAt: Date.now() });
    const productId = createProduct(database);
    recordStockMovement(database, { productId, type: 'purchase', quantity: 5 });
    changeEventStatus(database, { eventId: source.id, status: 'closed' });
    const destination = createEvent(database, {
      name: 'Evento aberto',
      startsAt: Date.now() + 86_400_000,
    });

    expect(
      transferStockBetweenEvents(database, {
        productId,
        sourceEventId: source.id,
        destinationEventId: destination.id,
        quantity: 2,
      }).sourceQuantityAfter,
    ).toBe(3);

    changeEventStatus(database, { eventId: source.id, status: 'archived' });
    expect(() =>
      transferStockBetweenEvents(database, {
        productId,
        sourceEventId: source.id,
        destinationEventId: destination.id,
        quantity: 1,
      }),
    ).toThrow('Não é possível retirar estoque de um evento arquivado.');

    changeEventStatus(database, { eventId: destination.id, status: 'closed' });
    const anotherSource = createEvent(database, {
      name: 'Outra origem',
      startsAt: Date.now() + 172_800_000,
    });
    setActiveEvent(database, anotherSource.id);
    recordStockMovement(database, { productId, type: 'purchase', quantity: 2 });
    expect(() =>
      transferStockBetweenEvents(database, {
        productId,
        sourceEventId: anotherSource.id,
        destinationEventId: destination.id,
        quantity: 1,
      }),
    ).toThrow('O evento de destino precisa estar aberto.');
    database.close();
  });

  it('bloqueia transferência e histórico no perfil Caixa', async () => {
    const database = await createTemporaryDatabase();
    const source = createEvent(database, { name: 'Origem Caixa', startsAt: Date.now() });
    const productId = createProduct(database);
    recordStockMovement(database, { productId, type: 'purchase', quantity: 2 });
    const destination = createEvent(database, {
      name: 'Destino Caixa',
      startsAt: Date.now() + 86_400_000,
    });
    switchProfile(database, 'cashier');

    expect(() => listStockTransfers(database)).toThrow(
      'Transferências de estoque exigem o perfil Produção.',
    );
    expect(() =>
      transferStockBetweenEvents(database, {
        productId,
        sourceEventId: source.id,
        destinationEventId: destination.id,
        quantity: 1,
      }),
    ).toThrow('Transferências de estoque exigem o perfil Produção.');
    database.close();
  });
});
