import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  addOrderItem,
  bindOrderVoucher,
  closeOrder,
  createEvent,
  createInventoryProduct,
  createProductCategory,
  createServicePoint,
  createVoucher,
  deleteEvent,
  deleteServicePoint,
  getOperationState,
  getOrder,
  getVoucherState,
  listEvents,
  openDatabase,
  openOrder,
  previewDeleteServicePoint,
  recordStockMovement,
  type DatabaseContext,
} from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-service-point-delete-'));
  return openDatabase(path.join(temporaryDirectory, 'service-point-delete.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

function seedSale(database: DatabaseContext): {
  readonly eventId: string;
  readonly tableId: string;
  readonly productId: string;
  readonly voucherId: string;
  readonly paidOrderId: string;
} {
  const event = createEvent(database, { name: 'Evento exclusão mesa', startsAt: Date.now() });
  const category = createProductCategory(database, 'Mesa teste');
  const product = createInventoryProduct(database, {
    categoryId: category.id,
    name: 'Produto mesa',
    kind: 'drink',
    costCents: 200,
    salePriceCents: 1000,
    lowStockThreshold: 1,
  });
  recordStockMovement(database, { productId: product.id, type: 'purchase', quantity: 5 });
  const table = createServicePoint(database, { label: 'Mesa 20', type: 'table' });
  const voucher = createVoucher(database, {
    code: 'MESA-20',
    label: 'Crédito Mesa 20',
    linkedServicePointId: table.id,
    initialBalanceCents: 2000,
  });
  let order = openOrder(database, table.id);
  order = addOrderItem(database, {
    orderId: order.id,
    itemKind: 'product',
    itemId: product.id,
    quantity: 1,
  });
  bindOrderVoucher(database, { orderId: order.id, code: voucher.code });
  const paid = closeOrder(database, {
    orderId: order.id,
    discountCents: 0,
    payments: [],
    voucherUses: [{ code: voucher.code, amountCents: 1000 }],
  });

  return {
    eventId: event.id,
    tableId: table.id,
    productId: product.id,
    voucherId: voucher.id,
    paidOrderId: paid.id,
  };
}

function getStock(database: DatabaseContext, eventId: string, productId: string): number {
  const row = database.sqlite
    .prepare('SELECT quantity FROM event_stock WHERE event_id = ? AND product_id = ?')
    .get(eventId, productId) as { readonly quantity: number } | undefined;
  return row?.quantity ?? 0;
}

describe('service point deletion', () => {
  it('mantém vendas pagas e consumo de voucher ao excluir a mesa no modo keep-sales', async () => {
    const database = await createTemporaryDatabase();
    const seeded = seedSale(database);
    const open = openOrder(database, seeded.tableId);
    bindOrderVoucher(database, { orderId: open.id, code: 'MESA-20' });

    expect(previewDeleteServicePoint(database, { servicePointId: seeded.tableId })).toMatchObject({
      servicePointId: seeded.tableId,
      label: 'Mesa 20',
      openOrders: 1,
      paidOrders: 1,
      paidSalesCents: 1000,
      voucherConsumedCents: 1000,
      linkedVouchers: 1,
    });

    deleteServicePoint(database, {
      servicePointId: seeded.tableId,
      mode: 'keep-sales',
      reason: 'Mesa removida do mapa do evento',
    });

    expect(getOperationState(database).servicePoints.some((item) => item.id === seeded.tableId)).toBe(
      false,
    );
    expect(getOrder(database, seeded.paidOrderId).status).toBe('paid');
    expect(getOrder(database, open.id).status).toBe('cancelled');
    expect(getStock(database, seeded.eventId, seeded.productId)).toBe(4);
    expect(getVoucherState(database).vouchers.find((item) => item.id === seeded.voucherId)).toMatchObject({
      remainingBalanceCents: 1000,
      linkedServicePointId: null,
      linkedServicePointLabel: null,
    });
    expect(
      database.sqlite
        .prepare("SELECT COUNT(*) AS value FROM audit_log WHERE action = 'operations.service-point-deleted'")
        .get(),
    ).toEqual({ value: 1 });
    database.close();
  });

  it('estorna vendas pagas, recompõe estoque e devolve saldo de voucher', async () => {
    const database = await createTemporaryDatabase();
    const seeded = seedSale(database);

    deleteServicePoint(database, {
      servicePointId: seeded.tableId,
      mode: 'refund-sales',
      reason: 'Mesa cadastrada por engano',
    });

    expect(getOrder(database, seeded.paidOrderId).status).toBe('cancelled');
    expect(getStock(database, seeded.eventId, seeded.productId)).toBe(5);
    expect(getVoucherState(database).vouchers.find((item) => item.id === seeded.voucherId)).toMatchObject({
      remainingBalanceCents: 2000,
      linkedServicePointId: null,
      linkedServicePointLabel: null,
    });
    expect(
      database.sqlite
        .prepare("SELECT COUNT(*) AS value FROM voucher_transactions WHERE type = 'refund'")
        .get(),
    ).toEqual({ value: 1 });
    database.close();
  });

  it('não permite excluir o balcão permanente nem excluir a mesma mesa duas vezes', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento proteções mesa', startsAt: Date.now() });
    const state = getOperationState(database);
    const counter = state.servicePoints.find((item) => item.type === 'counter');
    const table = createServicePoint(database, { label: 'Mesa descartável', type: 'table' });

    if (counter === undefined) {
      throw new Error('Balcão permanente não foi criado.');
    }

    expect(() =>
      previewDeleteServicePoint(database, { servicePointId: counter.id }),
    ).toThrow('O balcão permanente não pode ser excluído.');

    deleteServicePoint(database, {
      servicePointId: table.id,
      mode: 'keep-sales',
      reason: 'Mesa não será utilizada',
    });
    expect(() =>
      deleteServicePoint(database, {
        servicePointId: table.id,
        mode: 'keep-sales',
        reason: 'Segunda tentativa',
      }),
    ).toThrow('Esta mesa já foi excluída.');
    database.close();
  });

  it('exclui evento logicamente sem apagar o histórico relacionado', async () => {
    const database = await createTemporaryDatabase();
    const event = createEvent(database, { name: 'Evento removível', startsAt: Date.now() });
    const table = createServicePoint(database, { label: 'Mesa histórica', type: 'table' });

    deleteEvent(database, { eventId: event.id });

    expect(listEvents(database).some((item) => item.id === event.id)).toBe(false);
    expect(
      database.sqlite.prepare('SELECT deleted_at FROM events WHERE id = ?').get(event.id),
    ).toMatchObject({ deleted_at: expect.any(Number) });
    expect(
      database.sqlite.prepare('SELECT id FROM service_points WHERE id = ?').get(table.id),
    ).toEqual({ id: table.id });
    database.close();
  });
});
