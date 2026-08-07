import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  addOrderItem,
  bindOrderVoucher,
  changeVoucherStatus,
  closeOrder,
  createEvent,
  createInventoryProduct,
  createProductCategory,
  createServicePoint,
  createVoucher,
  deleteVoucher,
  getOperationState,
  getOrder,
  listAvailableVouchersForServicePoint,
  openDatabase,
  openOrder,
  previewDeleteVoucher,
  recordStockMovement,
  switchProfile,
  type DatabaseContext,
} from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-voucher-operational-'));
  return openDatabase(path.join(temporaryDirectory, 'voucher-operational.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

function seedProduct(database: DatabaseContext): string {
  const category = createProductCategory(database, 'Operação voucher');
  const product = createInventoryProduct(database, {
    categoryId: category.id,
    name: 'Produto impacto voucher',
    kind: 'drink',
    costCents: 200,
    salePriceCents: 1000,
    lowStockThreshold: 1,
  });
  recordStockMovement(database, { productId: product.id, type: 'purchase', quantity: 3 });
  return product.id;
}

function getStock(database: DatabaseContext, eventId: string, productId: string): number {
  const row = database.sqlite
    .prepare('SELECT quantity FROM event_stock WHERE event_id = ? AND product_id = ?')
    .get(eventId, productId) as { readonly quantity: number } | undefined;
  return row?.quantity ?? 0;
}

describe('voucher operational queries and deletion impact', () => {
  it('consulta no banco somente vouchers ativos vinculados à mesa e permite leitura no Caixa', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento consulta voucher', startsAt: Date.now() });
    const firstTable = createServicePoint(database, { label: 'Mesa 10', type: 'table' });
    const secondTable = createServicePoint(database, { label: 'Mesa 11', type: 'table' });
    const firstVoucher = createVoucher(database, {
      code: 'MESA-10-A',
      label: 'Crédito da mesa 10',
      linkedServicePointId: firstTable.id,
      initialBalanceCents: 1000,
    });
    const cancelledVoucher = createVoucher(database, {
      code: 'MESA-10-B',
      label: 'Crédito cancelado',
      linkedServicePointId: firstTable.id,
      initialBalanceCents: 500,
    });
    createVoucher(database, {
      code: 'MESA-11-A',
      label: 'Crédito da mesa 11',
      linkedServicePointId: secondTable.id,
      initialBalanceCents: 700,
    });
    changeVoucherStatus(database, { voucherId: cancelledVoucher.id, status: 'cancelled' });
    switchProfile(database, 'cashier');

    const available = listAvailableVouchersForServicePoint(database, {
      servicePointId: firstTable.id,
    });

    expect(available).toHaveLength(1);
    expect(available[0]).toMatchObject({
      id: firstVoucher.id,
      code: 'MESA-10-A',
      linkedServicePointId: firstTable.id,
      status: 'active',
      remainingBalanceCents: 1000,
    });
    expect(() =>
      listAvailableVouchersForServicePoint(database, { servicePointId: secondTable.id }),
    ).not.toThrow();
    database.close();
  });

  it('prévia identifica pagamentos, receita e estoque antes da exclusão transacional', async () => {
    const database = await createTemporaryDatabase();
    const event = createEvent(database, { name: 'Evento impacto voucher', startsAt: Date.now() });
    const productId = seedProduct(database);
    const counter = getOperationState(database).servicePoints[0];

    if (counter === undefined) {
      throw new Error('Balcão não criado.');
    }

    const voucher = createVoucher(database, {
      code: 'IMPACTO-01',
      label: 'Voucher de impacto',
      linkedServicePointId: counter.id,
      initialBalanceCents: 1000,
    });
    const order = openOrder(database, counter.id);
    addOrderItem(database, {
      orderId: order.id,
      itemKind: 'product',
      itemId: productId,
      quantity: 1,
    });
    bindOrderVoucher(database, { orderId: order.id, code: voucher.code });
    closeOrder(database, {
      orderId: order.id,
      discountCents: 0,
      payments: [{ method: 'cash', amountCents: 600, receivedCents: 1000 }],
      voucherUses: [{ code: voucher.code, amountCents: 400 }],
    });

    expect(getStock(database, event.id, productId)).toBe(2);
    const preview = previewDeleteVoucher(database, { voucherId: voucher.id });

    expect(preview).toMatchObject({
      voucherId: voucher.id,
      paidOrders: 1,
      refundVoucherCents: 400,
      affectedOrderTotalCents: 1000,
      financialImpact: {
        affectedRevenueCents: 1000,
        nonVoucherPaymentCents: 600,
        voucherRefundCents: 400,
        paymentRecordCount: 1,
        voucherRedemptionRecordCount: 1,
      },
    });
    expect(preview.affectedPayments).toHaveLength(1);
    expect(preview.affectedPayments[0]).toMatchObject({
      orderId: order.id,
      method: 'cash',
      amountCents: 600,
      receivedCents: 1000,
      changeCents: 400,
    });
    expect(preview.stockReturns).toEqual([
      {
        productId,
        productName: 'Produto impacto voucher',
        quantity: 1,
      },
    ]);

    deleteVoucher(database, { voucherId: voucher.id, reason: 'Emissão operacional incorreta' });
    expect(getOrder(database, order.id).status).toBe('cancelled');
    expect(getStock(database, event.id, productId)).toBe(3);
    database.close();
  });
});
