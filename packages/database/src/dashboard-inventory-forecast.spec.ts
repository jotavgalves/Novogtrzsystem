import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  addOrderItem,
  cancelOrder,
  closeOrder,
  createEvent,
  createInventoryProduct,
  createProductCategory,
  getDashboardState,
  getOperationState,
  openDatabase,
  openOrder,
  recordStockMovement,
  type DatabaseContext,
} from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-dashboard-forecast-'));
  return openDatabase(path.join(temporaryDirectory, 'forecast.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

describe('dashboard inventory forecast', () => {
  it('calcula quantas unidades pagam o custo e o valor potencial do estoque em tempo real', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento previsão', startsAt: Date.now() });
    const category = createProductCategory(database, 'Bebidas');
    const product = createInventoryProduct(database, {
      categoryId: category.id,
      name: 'Coca-Cola',
      kind: 'drink',
      costCents: 200,
      salePriceCents: 500,
      lowStockThreshold: 5,
    });
    recordStockMovement(database, { productId: product.id, type: 'purchase', quantity: 30 });

    const counter = getOperationState(database).servicePoints.find(
      (item) => item.type === 'counter',
    );
    if (counter === undefined) {
      throw new Error('Balcão não criado.');
    }

    const order = openOrder(database, counter.id);
    addOrderItem(database, {
      orderId: order.id,
      itemKind: 'product',
      itemId: product.id,
      quantity: 3,
    });
    closeOrder(database, {
      orderId: order.id,
      discountCents: 0,
      payments: [{ method: 'pix', amountCents: 1500 }],
      voucherUses: [],
    });

    const soldState = getDashboardState(database);
    expect(soldState.inventory).toMatchObject({
      units: 27,
      stockCostCents: 5400,
      potentialRevenueCents: 13_500,
      potentialGrossProfitCents: 8100,
    });
    expect(soldState.inventoryBreakEven).toContainEqual(
      expect.objectContaining({
        productId: product.id,
        productName: 'Coca-Cola',
        categoryName: 'Bebidas',
        purchasedUnits: 30,
        purchaseCostCents: 6000,
        salePriceCents: 500,
        soldUnits: 3,
        currentStockUnits: 27,
        breakEvenUnits: 12,
        remainingUnitsToBreakEven: 9,
      }),
    );

    cancelOrder(database, { orderId: order.id, reason: 'Teste de estorno da previsão' });
    const refundedState = getDashboardState(database);
    expect(refundedState.inventory).toMatchObject({
      units: 30,
      potentialRevenueCents: 15_000,
    });
    expect(refundedState.inventoryBreakEven[0]).toMatchObject({
      soldUnits: 0,
      currentStockUnits: 30,
      remainingUnitsToBreakEven: 12,
    });
    database.close();
  });
});
