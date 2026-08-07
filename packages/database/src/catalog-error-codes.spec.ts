import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createCombo,
  createEvent,
  createInventoryProduct,
  createProductCategory,
  openDatabase,
  recordStockMovement,
  requireCombo,
  switchProfile,
  type DatabaseContext,
} from './index';
import { isDatabaseError } from './database-error';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-catalog-errors-'));
  return openDatabase(path.join(temporaryDirectory, 'catalog-errors.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

function captureDatabaseError(operation: () => unknown): {
  readonly code: string;
  readonly details: Readonly<Record<string, unknown>> | null;
} {
  try {
    operation();
  } catch (error: unknown) {
    expect(isDatabaseError(error)).toBe(true);

    if (isDatabaseError(error)) {
      return { code: error.code, details: error.details };
    }
  }

  throw new Error('A operação deveria ter falhado com um erro tipado.');
}

describe('catalog stable error codes', () => {
  it('classifica saldo insuficiente e duplicidade de categoria', async () => {
    const database = await createTemporaryDatabase();
    const event = createEvent(database, { name: 'Evento catálogo tipado', startsAt: Date.now() });
    const category = createProductCategory(database, 'Bebidas tipadas');
    const product = createInventoryProduct(database, {
      categoryId: category.id,
      name: 'Água tipada',
      kind: 'drink',
      costCents: 100,
      salePriceCents: 300,
      lowStockThreshold: 1,
    });
    recordStockMovement(database, { productId: product.id, type: 'purchase', quantity: 1 });

    expect(
      captureDatabaseError(() =>
        recordStockMovement(database, { productId: product.id, type: 'loss', quantity: 2 }),
      ),
    ).toEqual({
      code: 'INSUFFICIENT_STOCK',
      details: {
        eventId: event.id,
        productId: product.id,
        movementType: 'loss',
        requestedQuantity: 2,
        availableQuantity: 1,
      },
    });
    expect(captureDatabaseError(() => createProductCategory(database, 'Bebidas tipadas'))).toEqual({
      code: 'CONFLICT',
      details: { entityType: 'product-category', name: 'Bebidas tipadas' },
    });
    database.close();
  });

  it('classifica combo ausente, duplicado e administração no Caixa', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento combo tipado', startsAt: Date.now() });
    const category = createProductCategory(database, 'Produtos combo');
    const product = createInventoryProduct(database, {
      categoryId: category.id,
      name: 'Produto combo tipado',
      kind: 'food',
      costCents: 200,
      salePriceCents: 500,
      lowStockThreshold: 0,
    });

    expect(captureDatabaseError(() => requireCombo(database, 'missing-combo'))).toEqual({
      code: 'NOT_FOUND',
      details: { comboId: 'missing-combo' },
    });
    createCombo(database, {
      name: 'Combo tipado',
      salePriceCents: 700,
      components: [{ productId: product.id, quantity: 1 }],
    });
    expect(
      captureDatabaseError(() =>
        createCombo(database, {
          name: 'Combo tipado',
          salePriceCents: 700,
          components: [{ productId: product.id, quantity: 1 }],
        }),
      ),
    ).toEqual({ code: 'CONFLICT', details: { name: 'Combo tipado' } });

    switchProfile(database, 'cashier');
    expect(captureDatabaseError(() => createProductCategory(database, 'Proibida'))).toEqual({
      code: 'FORBIDDEN',
      details: { requiredProfile: 'production' },
    });
    database.close();
  });
});
