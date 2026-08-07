import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  addOrderItem,
  closeCashRegister,
  closeOrder,
  createEvent,
  createExpense,
  createInventoryProduct,
  createProductCategory,
  createTicketLot,
  createTicketSale,
  createVoucher,
  getOperationState,
  openCashRegister,
  openDatabase,
  openOrder,
  previewEventClose,
  recordStockMovement,
  switchProfile,
  type DatabaseContext,
} from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-event-close-'));
  return openDatabase(path.join(temporaryDirectory, 'event-close.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

function seedProduct(database: DatabaseContext): string {
  const category = createProductCategory(database, 'Encerramento');
  const product = createInventoryProduct(database, {
    categoryId: category.id,
    name: 'Produto encerramento',
    kind: 'drink',
    costCents: 250,
    salePriceCents: 1000,
    lowStockThreshold: 1,
  });
  recordStockMovement(database, { productId: product.id, type: 'purchase', quantity: 5 });
  return product.id;
}

function openProductOrder(database: DatabaseContext, productId: string): string {
  const counter = getOperationState(database).servicePoints[0];

  if (counter === undefined) {
    throw new Error('Balcão não criado.');
  }

  const order = openOrder(database, counter.id);
  return addOrderItem(database, {
    orderId: order.id,
    itemKind: 'product',
    itemId: productId,
    quantity: 1,
  }).id;
}

describe('event close summary', () => {
  it('consolida operação financeira e preserva a diferença de caixa', async () => {
    const database = await createTemporaryDatabase();
    const event = createEvent(database, { name: 'Evento consolidado', startsAt: Date.now() });
    const productId = seedProduct(database);
    openCashRegister(database, 500);
    closeOrder(database, {
      orderId: openProductOrder(database, productId),
      discountCents: 0,
      payments: [{ method: 'cash', amountCents: 1000, receivedCents: 1000 }],
    });
    createExpense(database, {
      category: 'Equipe',
      description: 'Apoio operacional',
      amountCents: 200,
      paymentMethod: 'pix',
    });
    const lot = createTicketLot(database, {
      name: 'Portaria',
      priceCents: 300,
      capacity: 10,
    });
    createTicketSale(database, {
      lotId: lot.id,
      attendeeName: 'Grupo encerramento',
      source: 'door',
      quantity: 2,
      paymentMethod: 'pix',
    });
    createTicketSale(database, {
      lotId: lot.id,
      attendeeName: 'Cortesia encerramento',
      source: 'courtesy',
      quantity: 1,
    });
    createVoucher(database, {
      code: 'FIM-001',
      label: 'Crédito remanescente',
      initialBalanceCents: 500,
    });

    expect(previewEventClose(database, event.id)).toMatchObject({
      eventId: event.id,
      openOrdersCount: 0,
      paidOrdersCount: 1,
      cashStatus: 'open',
      requiresCashCount: true,
      expectedCashCents: 1500,
      salesByMethod: {
        cashCents: 1000,
        pixCents: 600,
        creditCardCents: 0,
        debitCardCents: 0,
        voucherCents: 0,
      },
      grossSalesCents: 1600,
      activeExpensesCents: 200,
      projectedResultCents: 1400,
      ticketSalesCount: 2,
      ticketSoldQuantity: 2,
      ticketCourtesyQuantity: 1,
      ticketRevenueCents: 600,
      voucherCount: 1,
      vouchersIssuedCents: 500,
      vouchersRemainingCents: 500,
      blockers: [],
      canClose: true,
    });

    closeCashRegister(database, 1450);
    expect(previewEventClose(database, event.id)).toMatchObject({
      cashStatus: 'closed',
      requiresCashCount: false,
      countedCashCents: 1450,
      varianceCents: -50,
      canClose: true,
    });
    database.close();
  });

  it('bloqueia comanda aberta e administração pelo perfil Caixa', async () => {
    const database = await createTemporaryDatabase();
    const event = createEvent(database, { name: 'Evento bloqueado', startsAt: Date.now() });
    const productId = seedProduct(database);
    openCashRegister(database, 0);
    openProductOrder(database, productId);

    const blocked = previewEventClose(database, event.id);
    expect(blocked.canClose).toBe(false);
    expect(blocked.openOrdersCount).toBe(1);
    expect(blocked.blockers[0]).toContain('1 comandas abertas');

    switchProfile(database, 'cashier');
    expect(() => previewEventClose(database, event.id)).toThrow(
      'O encerramento do evento exige o perfil Produção.',
    );
    database.close();
  });
});
