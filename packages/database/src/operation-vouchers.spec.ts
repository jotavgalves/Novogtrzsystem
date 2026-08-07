import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  addOrderItem,
  bindOrderVoucher,
  cancelOrder,
  closeOrder,
  createEvent,
  createInventoryProduct,
  createProductCategory,
  createServicePoint,
  createVoucher,
  getOrder,
  openDatabase,
  openOrder,
  recordStockMovement,
  unbindOrderVoucher,
  type DatabaseContext,
} from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-order-voucher-'));
  return openDatabase(path.join(temporaryDirectory, 'order-voucher.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

function seedOrder(database: DatabaseContext, tableLabel: string): string {
  const category = createProductCategory(database, `Bebidas ${tableLabel}`);
  const product = createInventoryProduct(database, {
    categoryId: category.id,
    name: `Água ${tableLabel}`,
    kind: 'drink',
    costCents: 100,
    salePriceCents: 1000,
    lowStockThreshold: 1,
  });
  recordStockMovement(database, { productId: product.id, type: 'purchase', quantity: 5 });
  const table = createServicePoint(database, { label: tableLabel, type: 'table' });
  const order = openOrder(database, table.id);
  return addOrderItem(database, {
    orderId: order.id,
    itemKind: 'product',
    itemId: product.id,
    quantity: 1,
  }).id;
}

describe('voucher vinculado à comanda', () => {
  it('persiste na mesa, impede uso simultâneo e libera ao remover', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento vínculo', startsAt: Date.now() });
    const firstOrderId = seedOrder(database, 'Mesa A');
    const secondOrderId = seedOrder(database, 'Mesa B');
    const voucher = createVoucher(database, {
      code: 'VCH-MESA',
      label: 'Crédito mesa',
      initialBalanceCents: 1500,
    });

    bindOrderVoucher(database, { orderId: firstOrderId, code: voucher.code });
    expect(getOrder(database, firstOrderId).voucherAllocation).toMatchObject({
      code: voucher.code,
      label: 'Crédito mesa',
      remainingBalanceCents: 1500,
    });
    expect(() =>
      bindOrderVoucher(database, { orderId: secondOrderId, code: voucher.code }),
    ).toThrow('já está vinculado a Mesa A');

    unbindOrderVoucher(database, firstOrderId);
    expect(getOrder(database, firstOrderId).voucherAllocation).toBeNull();
    expect(() =>
      bindOrderVoucher(database, { orderId: secondOrderId, code: voucher.code }),
    ).not.toThrow();
    database.close();
  });

  it('formata saldo em reais, consome somente no fechamento e libera ao cancelar', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento saldo', startsAt: Date.now() });
    const orderId = seedOrder(database, 'Mesa saldo');
    const voucher = createVoucher(database, {
      code: 'VCH-SALDO',
      label: 'Crédito limitado',
      initialBalanceCents: 400,
    });

    bindOrderVoucher(database, { orderId, code: voucher.code });
    expect(() =>
      closeOrder(database, {
        orderId,
        discountCents: 0,
        payments: [{ method: 'cash', amountCents: 500, receivedCents: 1000 }],
        voucherUses: [{ code: voucher.code, amountCents: 500 }],
      }),
    ).toThrow(/Disponível: R\$\s4,00\./u);
    expect(getOrder(database, orderId)).toMatchObject({
      status: 'open',
      voucherAllocation: { remainingBalanceCents: 400 },
    });

    const paid = closeOrder(database, {
      orderId,
      discountCents: 0,
      payments: [{ method: 'cash', amountCents: 600, receivedCents: 1000 }],
      voucherUses: [{ code: voucher.code, amountCents: 400 }],
    });
    expect(paid.voucherAllocation).toBeNull();
    expect(paid.payments[0]).toMatchObject({ changeCents: 400 });

    cancelOrder(database, { orderId, reason: 'Estorno para validar restituição' });
    const balance = database.sqlite
      .prepare('SELECT remaining_balance_cents FROM vouchers WHERE id = ?')
      .get(voucher.id);
    expect(balance).toEqual({ remaining_balance_cents: 400 });
    database.close();
  });
});
