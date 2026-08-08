import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  addOrderItem,
  closeOrder,
  createEvent,
  createInventoryProduct,
  createProductCategory,
  getCashState,
  getOperationState,
  openCashRegister,
  openDatabase,
  openOrder,
  recordStockMovement,
  type DatabaseContext,
} from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-change-'));
  return openDatabase(path.join(temporaryDirectory, 'change.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

describe('physical cash change', () => {
  it('considera recebido menos troco como entrada liquida no caixa', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento troco', startsAt: Date.now() });
    const category = createProductCategory(database, 'Bebidas');
    const product = createInventoryProduct(database, {
      categoryId: category.id,
      name: 'Água',
      kind: 'drink',
      costCents: 200,
      salePriceCents: 1000,
      lowStockThreshold: 1,
    });
    recordStockMovement(database, { productId: product.id, type: 'purchase', quantity: 5 });
    openCashRegister(database, 1000);

    const counter = getOperationState(database).servicePoints.find((item) => item.type === 'counter');
    if (counter === undefined) {
      throw new Error('Balcão não criado.');
    }
    const order = openOrder(database, counter.id);
    addOrderItem(database, {
      orderId: order.id,
      itemKind: 'product',
      itemId: product.id,
      quantity: 1,
    });
    const paid = closeOrder(database, {
      orderId: order.id,
      discountCents: 0,
      payments: [{ method: 'cash', amountCents: 1000, receivedCents: 1500 }],
      voucherUses: [],
    });

    expect(paid.payments[0]).toMatchObject({
      amountCents: 1000,
      receivedCents: 1500,
      changeCents: 500,
    });
    expect(getCashState(database)).toMatchObject({
      salesByMethod: { cashCents: 1000 },
      expectedCashCents: 2000,
    });
    database.close();
  });
});
