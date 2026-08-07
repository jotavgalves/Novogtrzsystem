import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createEvent,
  createInventoryProduct,
  createProductCategory,
  openDatabase,
  recordStockMovement,
  switchProfile,
  type DatabaseContext,
} from './index';
import { isDatabaseError } from './database-error';
import { requireAvailableCatalogItem } from './operation-stock';
import { requireTicketLot, requireTicketProduction } from './ticket-repository';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-domain-errors-'));
  return openDatabase(path.join(temporaryDirectory, 'domain-errors.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

function expectDatabaseError(
  operation: () => unknown,
  expectedCode: 'FORBIDDEN' | 'NOT_FOUND' | 'INSUFFICIENT_STOCK',
): Readonly<Record<string, unknown>> | null {
  try {
    operation();
  } catch (error: unknown) {
    expect(isDatabaseError(error)).toBe(true);

    if (isDatabaseError(error)) {
      expect(error.code).toBe(expectedCode);
      return error.details;
    }
  }

  throw new Error(`A operação deveria falhar com ${expectedCode}.`);
}

describe('stable domain error codes', () => {
  it('distingue permissão e entidade inexistente sem interpretar mensagem', async () => {
    const database = await createTemporaryDatabase();
    const event = createEvent(database, { name: 'Evento erros', startsAt: Date.now() });

    expect(expectDatabaseError(() => requireTicketLot(database, event.id, 'missing'), 'NOT_FOUND')).toEqual(
      { eventId: event.id, lotId: 'missing' },
    );

    switchProfile(database, 'cashier');
    expect(expectDatabaseError(() => requireTicketProduction(database), 'FORBIDDEN')).toEqual({
      requiredProfile: 'production',
    });
    database.close();
  });

  it('transporta saldo de estoque disponível e quantidade solicitada como dados', async () => {
    const database = await createTemporaryDatabase();
    const event = createEvent(database, { name: 'Evento estoque tipado', startsAt: Date.now() });
    const category = createProductCategory(database, 'Estoque tipado');
    const product = createInventoryProduct(database, {
      categoryId: category.id,
      name: 'Produto limitado',
      kind: 'drink',
      costCents: 100,
      salePriceCents: 300,
      lowStockThreshold: 1,
    });
    recordStockMovement(database, { productId: product.id, type: 'purchase', quantity: 1 });

    expect(
      expectDatabaseError(
        () => requireAvailableCatalogItem(database, event.id, 'product', product.id, 2),
        'INSUFFICIENT_STOCK',
      ),
    ).toMatchObject({
      eventId: event.id,
      itemKind: 'product',
      itemId: product.id,
      requestedQuantity: 2,
      availableQuantity: 1,
    });
    database.close();
  });
});
