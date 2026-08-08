import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  addOrderItem,
  bindOrderVoucher,
  closeOrder,
  createEvent,
  createExpense,
  createInventoryProduct,
  createProductCategory,
  createServicePoint,
  createTicketLot,
  createTicketSale,
  createVoucher,
  getDashboardState,
  openDatabase,
  openOrder,
  recordStockMovement,
  type DatabaseContext,
} from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-dashboard-'));
  return openDatabase(path.join(temporaryDirectory, 'dashboard.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

describe('dashboard SQL aggregates', () => {
  it('concilia receita, voucher, ingresso, despesas manuais e compras de estoque', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento dashboard completo', startsAt: Date.now() });
    const category = createProductCategory(database, 'Dashboard');
    const product = createInventoryProduct(database, {
      categoryId: category.id,
      name: 'Produto dashboard',
      kind: 'drink',
      costCents: 300,
      salePriceCents: 1000,
      lowStockThreshold: 1,
    });
    recordStockMovement(database, { productId: product.id, type: 'purchase', quantity: 5 });
    const table = createServicePoint(database, { label: 'Mesa Dashboard', type: 'table' });
    const voucher = createVoucher(database, {
      code: 'DASH-001',
      label: 'Crédito dashboard',
      linkedServicePointId: table.id,
      initialBalanceCents: 1000,
    });
    const order = openOrder(database, table.id);
    addOrderItem(database, {
      orderId: order.id,
      itemKind: 'product',
      itemId: product.id,
      quantity: 1,
    });
    bindOrderVoucher(database, { orderId: order.id, code: voucher.code });
    closeOrder(database, {
      orderId: order.id,
      discountCents: 100,
      payments: [{ method: 'cash', amountCents: 500, receivedCents: 500 }],
      voucherUses: [{ code: voucher.code, amountCents: 400 }],
    });

    const lot = createTicketLot(database, {
      name: 'Lote dashboard',
      priceCents: 5000,
      capacity: 3,
    });
    createTicketSale(database, {
      lotId: lot.id,
      attendeeName: 'Cliente ingresso',
      source: 'door',
      quantity: 1,
      paymentMethod: 'pix',
    });
    createTicketSale(database, {
      lotId: lot.id,
      attendeeName: 'Convidado',
      source: 'courtesy',
      quantity: 1,
    });
    createExpense(database, {
      category: 'Operação',
      description: 'Despesa dashboard',
      amountCents: 200,
      initialPaymentCents: 0,
      paymentMethod: 'pix',
    });

    const dashboard = getDashboardState(database);

    expect(dashboard).toMatchObject({
      grossRevenueCents: 6000,
      discountsCents: 100,
      netRevenueCents: 5900,
      grossSalesCents: 5900,
      completedSales: 2,
      activeExpensesCents: 1700,
      inventoryExpenseCents: 1500,
      projectedResultCents: 4200,
      vouchersUsedCents: 400,
      tickets: {
        sold: 1,
        courtesy: 1,
        available: 1,
        revenueCents: 5000,
      },
      vouchers: {
        active: 1,
        outstandingBalanceCents: 600,
      },
      inventory: {
        units: 4,
        activeProducts: 1,
        lowStockProducts: 0,
        stockCostCents: 1200,
      },
    });
    database.close();
  });
});
