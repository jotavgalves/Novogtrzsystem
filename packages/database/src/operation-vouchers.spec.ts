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

function seedOrder(
  database: DatabaseContext,
  tableLabel: string,
): { readonly orderId: string; readonly tableId: string } {
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
  const updated = addOrderItem(database, {
    orderId: order.id,
    itemKind: 'product',
    itemId: product.id,
    quantity: 1,
  });
  return { orderId: updated.id, tableId: table.id };
}

describe('voucher vinculado à comanda', () => {
  it('persiste na mesa vinculada e não pode migrar para outra comanda', async () => {
    const database = await createTemporaryDatabase();

    try {
      createEvent(database, { name: 'Evento vínculo', startsAt: Date.now() });
      const first = seedOrder(database, 'Mesa A');
      const second = seedOrder(database, 'Mesa B');
      const voucher = createVoucher(database, {
        code: 'VCH-MESA',
        label: 'Crédito mesa',
        linkedServicePointId: first.tableId,
        initialBalanceCents: 1500,
      });

      bindOrderVoucher(database, { orderId: first.orderId, code: voucher.code });
      expect(getOrder(database, first.orderId).voucherAllocation).toMatchObject({
        code: voucher.code,
        label: 'Crédito mesa',
        remainingBalanceCents: 1500,
      });
      expect(() =>
        bindOrderVoucher(database, { orderId: second.orderId, code: voucher.code }),
      ).toThrow('pertence a Mesa A');

      unbindOrderVoucher(database, first.orderId);
      expect(getOrder(database, first.orderId).voucherAllocation).toBeNull();
      expect(() =>
        bindOrderVoucher(database, { orderId: second.orderId, code: voucher.code }),
      ).toThrow('pertence a Mesa A');
      expect(() =>
        bindOrderVoucher(database, { orderId: first.orderId, code: voucher.code }),
      ).not.toThrow();
    } finally {
      database.close();
    }
  });

  it('formata saldo em reais, consome somente no fechamento e restitui ao cancelar', async () => {
    const database = await createTemporaryDatabase();

    try {
      createEvent(database, { name: 'Evento saldo', startsAt: Date.now() });
      const seeded = seedOrder(database, 'Mesa saldo');
      const voucher = createVoucher(database, {
        code: 'VCH-SALDO',
        label: 'Crédito limitado',
        linkedServicePointId: seeded.tableId,
        initialBalanceCents: 400,
      });

      bindOrderVoucher(database, { orderId: seeded.orderId, code: voucher.code });
      expect(() =>
        closeOrder(database, {
          orderId: seeded.orderId,
          discountCents: 0,
          payments: [{ method: 'cash', amountCents: 500, receivedCents: 1000 }],
          voucherUses: [{ code: voucher.code, amountCents: 500 }],
        }),
      ).toThrow(/Disponível: R\$\s4,00\./u);
      expect(getOrder(database, seeded.orderId)).toMatchObject({
        status: 'open',
        voucherAllocation: { remainingBalanceCents: 400 },
      });

      const paid = closeOrder(database, {
        orderId: seeded.orderId,
        discountCents: 0,
        payments: [{ method: 'cash', amountCents: 600, receivedCents: 1000 }],
        voucherUses: [{ code: voucher.code, amountCents: 400 }],
      });
      expect(paid.voucherAllocation).toBeNull();
      expect(paid.payments[0]).toMatchObject({ changeCents: 400 });

      cancelOrder(database, {
        orderId: seeded.orderId,
        reason: 'Estorno para validar restituição',
      });
      const balance = database.sqlite
        .prepare('SELECT remaining_balance_cents FROM vouchers WHERE id = ?')
        .get(voucher.id);
      expect(balance).toEqual({ remaining_balance_cents: 400 });
    } finally {
      database.close();
    }
  });
});
