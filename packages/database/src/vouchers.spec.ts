import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  addOrderItem,
  bindOrderVoucher,
  cancelOrder,
  changeVoucherStatus,
  closeOrder,
  createEvent,
  createInventoryProduct,
  createProductCategory,
  createServicePoint,
  createVoucher,
  deleteServicePoint,
  deleteVoucher,
  getOrder,
  getVoucherState,
  openDatabase,
  openOrder,
  previewDeleteVoucher,
  recordStockMovement,
  switchProfile,
  updateVoucher,
  type DatabaseContext,
} from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-vouchers-'));
  return openDatabase(path.join(temporaryDirectory, 'vouchers.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

function seedProduct(database: DatabaseContext): string {
  const category = createProductCategory(database, 'Voucher teste');
  const product = createInventoryProduct(database, {
    categoryId: category.id,
    name: 'Produto voucher',
    kind: 'drink',
    costCents: 200,
    salePriceCents: 1000,
    lowStockThreshold: 1,
  });
  recordStockMovement(database, { productId: product.id, type: 'purchase', quantity: 5 });
  return product.id;
}

function openProductOrder(
  database: DatabaseContext,
  productId: string,
  tableLabel: string,
): { readonly orderId: string; readonly tableId: string } {
  const table = createServicePoint(database, { label: tableLabel, type: 'table' });
  const order = openOrder(database, table.id);
  const updated = addOrderItem(database, {
    orderId: order.id,
    itemKind: 'product',
    itemId: productId,
    quantity: 1,
  });
  return { orderId: updated.id, tableId: table.id };
}

function getStock(database: DatabaseContext, eventId: string, productId: string): number {
  const row = database.sqlite
    .prepare('SELECT quantity FROM event_stock WHERE event_id = ? AND product_id = ?')
    .get(eventId, productId) as { readonly quantity: number } | undefined;
  return row?.quantity ?? 0;
}

describe('vouchers database', () => {
  it('emite voucher com código normalizado e razão inicial', async () => {
    const database = await createTemporaryDatabase();

    try {
      createEvent(database, { name: 'Evento voucher', startsAt: Date.now() });
      const table = createServicePoint(database, { label: 'Mesa VIP', type: 'table' });
      const voucher = createVoucher(database, {
        code: 'vip 001',
        label: 'Crédito VIP',
        linkedServicePointId: table.id,
        initialBalanceCents: 5000,
      });

      expect(voucher).toMatchObject({
        code: 'VIP-001',
        label: 'Crédito VIP',
        linkedServicePointId: table.id,
        initialBalanceCents: 5000,
        remainingBalanceCents: 5000,
        status: 'active',
      });
      expect(getVoucherState(database).transactions[0]).toMatchObject({
        voucherId: voucher.id,
        type: 'issue',
        amountCents: 5000,
        balanceBeforeCents: 0,
        balanceAfterCents: 5000,
      });
    } finally {
      database.close();
    }
  });

  it('emite voucher vinculado a uma mesa do evento ativo', async () => {
    const database = await createTemporaryDatabase();

    try {
      createEvent(database, { name: 'Evento voucher mesa', startsAt: Date.now() });
      const servicePoint = createServicePoint(database, { label: 'Mesa 12', type: 'table' });
      const voucher = createVoucher(database, {
        code: 'mesa-12',
        label: 'Crédito Mesa 12',
        linkedServicePointId: servicePoint.id,
        initialBalanceCents: 5000,
      });
      const state = getVoucherState(database);

      expect(state.servicePoints.map((item) => item.id)).toContain(servicePoint.id);
      expect(voucher).toMatchObject({
        code: 'MESA-12',
        linkedServicePointId: servicePoint.id,
        linkedServicePointLabel: 'Mesa 12',
      });
      expect(state.vouchers[0]).toMatchObject({
        linkedServicePointId: servicePoint.id,
        linkedServicePointLabel: 'Mesa 12',
      });
    } finally {
      database.close();
    }
  });

  it('mantém a mesa fixa e só libera novo vínculo após excluir a mesa', async () => {
    const database = await createTemporaryDatabase();

    try {
      createEvent(database, { name: 'Evento voucher editável', startsAt: Date.now() });
      const firstServicePoint = createServicePoint(database, { label: 'Mesa 1', type: 'table' });
      const secondServicePoint = createServicePoint(database, { label: 'Mesa 2', type: 'table' });
      const voucher = createVoucher(database, {
        code: 'edit-01',
        label: 'Voucher original',
        linkedServicePointId: firstServicePoint.id,
        initialBalanceCents: 1000,
      });

      const updated = updateVoucher(database, {
        voucherId: voucher.id,
        code: 'edit-02',
        label: 'Voucher atualizado',
        linkedServicePointId: firstServicePoint.id,
        addedBalanceCents: 500,
      });

      expect(updated).toMatchObject({
        code: 'EDIT-02',
        label: 'Voucher atualizado',
        linkedServicePointId: firstServicePoint.id,
        linkedServicePointLabel: 'Mesa 1',
        initialBalanceCents: 1500,
        remainingBalanceCents: 1500,
        status: 'active',
      });
      expect(() =>
        updateVoucher(database, {
          voucherId: voucher.id,
          code: 'edit-02',
          label: 'Mudança indevida',
          linkedServicePointId: secondServicePoint.id,
          addedBalanceCents: 0,
        }),
      ).toThrow('O vínculo do voucher com a mesa é fixo enquanto a mesa existir.');

      deleteServicePoint(database, {
        servicePointId: firstServicePoint.id,
        mode: 'keep-sales',
        reason: 'Mesa removida do evento',
      });
      expect(getVoucherState(database).vouchers[0]).toMatchObject({
        linkedServicePointId: null,
        linkedServicePointLabel: null,
      });

      const relinked = updateVoucher(database, {
        voucherId: voucher.id,
        code: 'edit-02',
        label: 'Voucher atualizado',
        linkedServicePointId: secondServicePoint.id,
        addedBalanceCents: 0,
      });
      expect(relinked).toMatchObject({
        linkedServicePointId: secondServicePoint.id,
        linkedServicePointLabel: 'Mesa 2',
        remainingBalanceCents: 1500,
      });
      expect(() =>
        updateVoucher(database, {
          voucherId: voucher.id,
          code: 'edit-02',
          label: 'Redução proibida',
          linkedServicePointId: secondServicePoint.id,
          addedBalanceCents: -1,
        }),
      ).toThrow('O acréscimo de saldo deve ser informado em centavos inteiros.');
      expect(
        getVoucherState(database).transactions.filter(
          (transaction) => transaction.type === 'issue' && transaction.amountCents === 500,
        ),
      ).toHaveLength(1);
    } finally {
      database.close();
    }
  });

  it('combina voucher parcial e dinheiro na mesma venda', async () => {
    const database = await createTemporaryDatabase();

    try {
      const event = createEvent(database, { name: 'Evento misto', startsAt: Date.now() });
      const productId = seedProduct(database);
      const seeded = openProductOrder(database, productId, 'Mesa Misto');
      const voucher = createVoucher(database, {
        code: 'MISTO-01',
        label: 'Crédito parcial',
        linkedServicePointId: seeded.tableId,
        initialBalanceCents: 700,
      });
      bindOrderVoucher(database, { orderId: seeded.orderId, code: voucher.code });
      const paidOrder = closeOrder(database, {
        orderId: seeded.orderId,
        discountCents: 0,
        payments: [{ method: 'cash', amountCents: 600, receivedCents: 1000 }],
        voucherUses: [{ code: voucher.code, amountCents: 400 }],
      });

      expect(paidOrder).toMatchObject({
        status: 'paid',
        totalCents: 1000,
        paidCents: 1000,
        remainingCents: 0,
      });
      expect(paidOrder.voucherRedemptions).toEqual([
        { voucherId: voucher.id, code: voucher.code, amountCents: 400 },
      ]);
      expect(paidOrder.payments[0]).toMatchObject({ amountCents: 600, changeCents: 400 });
      expect(getVoucherState(database).vouchers[0]?.remainingBalanceCents).toBe(300);
      expect(getStock(database, event.id, productId)).toBe(4);
    } finally {
      database.close();
    }
  });

  it('restitui exatamente o saldo usado quando a venda é estornada', async () => {
    const database = await createTemporaryDatabase();

    try {
      createEvent(database, { name: 'Evento restituição', startsAt: Date.now() });
      const productId = seedProduct(database);
      const seeded = openProductOrder(database, productId, 'Mesa Restituição');
      const voucher = createVoucher(database, {
        code: 'REFUND-01',
        label: 'Crédito restituível',
        linkedServicePointId: seeded.tableId,
        initialBalanceCents: 1000,
      });
      bindOrderVoucher(database, { orderId: seeded.orderId, code: voucher.code });
      closeOrder(database, {
        orderId: seeded.orderId,
        discountCents: 0,
        payments: [],
        voucherUses: [{ code: voucher.code, amountCents: 1000 }],
      });
      expect(getVoucherState(database).vouchers[0]).toMatchObject({
        remainingBalanceCents: 0,
        status: 'exhausted',
      });

      cancelOrder(database, { orderId: seeded.orderId, reason: 'Venda duplicada' });
      expect(getVoucherState(database).vouchers[0]).toMatchObject({
        remainingBalanceCents: 1000,
        status: 'active',
      });
      expect(
        getVoucherState(database).transactions.filter((transaction) => transaction.type === 'refund'),
      ).toHaveLength(1);
    } finally {
      database.close();
    }
  });

  it('pré-visualiza e exclui voucher preservando estado real na auditoria', async () => {
    const database = await createTemporaryDatabase();

    try {
      const event = createEvent(database, { name: 'Evento exclusão voucher', startsAt: Date.now() });
      const productId = seedProduct(database);
      const seeded = openProductOrder(database, productId, 'Mesa Exclusão');
      const voucher = createVoucher(database, {
        code: 'DEL-01',
        label: 'Voucher a excluir',
        linkedServicePointId: seeded.tableId,
        initialBalanceCents: 1000,
      });
      bindOrderVoucher(database, { orderId: seeded.orderId, code: voucher.code });
      closeOrder(database, {
        orderId: seeded.orderId,
        discountCents: 0,
        payments: [],
        voucherUses: [{ code: voucher.code, amountCents: 1000 }],
      });

      expect(getVoucherState(database).vouchers[0]).toMatchObject({
        status: 'exhausted',
        remainingBalanceCents: 0,
      });
      expect(previewDeleteVoucher(database, { voucherId: voucher.id })).toMatchObject({
        voucherId: voucher.id,
        remainingBalanceCents: 0,
        paidOrders: 1,
        refundVoucherCents: 1000,
        affectedOrderTotalCents: 1000,
      });
      expect(() =>
        deleteVoucher(database, {
          voucherId: voucher.id,
          reason: '  ',
        }),
      ).toThrow('Informe uma justificativa com pelo menos 3 caracteres.');

      const deleted = deleteVoucher(database, {
        voucherId: voucher.id,
        reason: 'Emissão incorreta',
      });

      expect(deleted.status).toBe('cancelled');
      expect(getOrder(database, seeded.orderId).status).toBe('cancelled');
      expect(getStock(database, event.id, productId)).toBe(5);
      expect(getVoucherState(database).vouchers[0]).toMatchObject({
        status: 'cancelled',
        remainingBalanceCents: 1000,
      });
      expect(() => previewDeleteVoucher(database, { voucherId: voucher.id })).toThrow(
        'Este voucher já está cancelado.',
      );
      const auditRow = database.sqlite
        .prepare(
          `SELECT before_json, after_json
           FROM audit_log
           WHERE action = 'voucher.deleted' AND entity_id = ?
           ORDER BY id DESC
           LIMIT 1`,
        )
        .get(voucher.id) as
        | { readonly before_json: string | null; readonly after_json: string | null }
        | undefined;
      expect(auditRow?.before_json).toContain('"status":"exhausted"');
      expect(auditRow?.after_json).toContain('"status":"cancelled"');
    } finally {
      database.close();
    }
  });

  it('faz rollback de estoque e comanda quando o voucher não possui saldo', async () => {
    const database = await createTemporaryDatabase();

    try {
      const event = createEvent(database, { name: 'Evento rollback voucher', startsAt: Date.now() });
      const productId = seedProduct(database);
      const seeded = openProductOrder(database, productId, 'Mesa Saldo Curto');
      const voucher = createVoucher(database, {
        code: 'CURTO-01',
        label: 'Saldo curto',
        linkedServicePointId: seeded.tableId,
        initialBalanceCents: 200,
      });
      bindOrderVoucher(database, { orderId: seeded.orderId, code: voucher.code });

      expect(() =>
        closeOrder(database, {
          orderId: seeded.orderId,
          discountCents: 0,
          payments: [{ method: 'pix', amountCents: 700 }],
          voucherUses: [{ code: voucher.code, amountCents: 300 }],
        }),
      ).toThrow(/Saldo insuficiente no voucher CURTO-01\. Disponível: R\$\s2,00\./u);
      expect(getOrder(database, seeded.orderId)).toMatchObject({ status: 'open', paidCents: 0 });
      expect(getStock(database, event.id, productId)).toBe(5);
      expect(getVoucherState(database).vouchers[0]?.remainingBalanceCents).toBe(200);
      expect(database.sqlite.prepare('SELECT COUNT(*) AS value FROM payments').get()).toEqual({
        value: 0,
      });
    } finally {
      database.close();
    }
  });

  it('preserva saldo ao cancelar e reativar e bloqueia administração no Caixa', async () => {
    const database = await createTemporaryDatabase();

    try {
      createEvent(database, { name: 'Evento estado voucher', startsAt: Date.now() });
      const table = createServicePoint(database, { label: 'Mesa Estado', type: 'table' });
      const voucher = createVoucher(database, {
        label: 'Voucher controlado',
        linkedServicePointId: table.id,
        initialBalanceCents: 1500,
      });

      expect(
        changeVoucherStatus(database, { voucherId: voucher.id, status: 'cancelled' }),
      ).toMatchObject({
        status: 'cancelled',
        remainingBalanceCents: 1500,
      });
      expect(changeVoucherStatus(database, { voucherId: voucher.id, status: 'active' }).status).toBe(
        'active',
      );
      switchProfile(database, 'cashier');
      expect(() =>
        createVoucher(database, {
          label: 'Proibido',
          linkedServicePointId: table.id,
          initialBalanceCents: 100,
        }),
      ).toThrow('A administração de vouchers exige o perfil Produção.');
      expect(() =>
        changeVoucherStatus(database, { voucherId: voucher.id, status: 'cancelled' }),
      ).toThrow('A administração de vouchers exige o perfil Produção.');
    } finally {
      database.close();
    }
  });
});
