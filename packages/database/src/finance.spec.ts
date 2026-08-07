import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  addOrderItem,
  bindOrderVoucher,
  cancelExpense,
  closeCashRegister,
  closeOrder,
  createEvent,
  createExpense,
  createInventoryProduct,
  createProductCategory,
  createVoucher,
  getCashState,
  getExpenseState,
  getOperationState,
  openCashRegister,
  openDatabase,
  openOrder,
  payExpense,
  previewCancelExpense,
  recordCashMovement,
  recordStockMovement,
  refundExpensePayment,
  switchProfile,
  updateExpense,
  type DatabaseContext,
} from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-finance-'));
  return openDatabase(path.join(temporaryDirectory, 'finance.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

function seedProduct(database: DatabaseContext): string {
  const category = createProductCategory(database, 'Financeiro');
  const product = createInventoryProduct(database, {
    categoryId: category.id,
    name: 'Produto financeiro',
    kind: 'drink',
    costCents: 200,
    salePriceCents: 1000,
    lowStockThreshold: 1,
  });
  recordStockMovement(database, { productId: product.id, type: 'purchase', quantity: 10 });
  return product.id;
}

function createOrder(database: DatabaseContext, productId: string): string {
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

describe('cash and expenses database', () => {
  it('concilia vendas por meio, voucher, despesas e movimentações físicas', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento financeiro', startsAt: Date.now() });
    const productId = seedProduct(database);
    const voucher = createVoucher(database, {
      code: 'FIN-001',
      label: 'Crédito financeiro',
      initialBalanceCents: 500,
    });
    openCashRegister(database, 1000);

    closeOrder(database, {
      orderId: createOrder(database, productId),
      discountCents: 0,
      payments: [{ method: 'cash', amountCents: 1000, receivedCents: 1500 }],
    });
    const voucherOrderId = createOrder(database, productId);
    bindOrderVoucher(database, { orderId: voucherOrderId, code: voucher.code });
    closeOrder(database, {
      orderId: voucherOrderId,
      discountCents: 0,
      payments: [{ method: 'pix', amountCents: 500 }],
      voucherUses: [{ code: voucher.code, amountCents: 500 }],
    });
    createExpense(database, {
      category: 'Operação',
      description: 'Gelo emergencial',
      amountCents: 300,
      paymentMethod: 'cash',
    });
    createExpense(database, {
      category: 'Mídia',
      description: 'Impulsionamento',
      amountCents: 200,
      paymentMethod: 'credit-card',
    });
    recordCashMovement(database, { type: 'supply', amountCents: 400, note: 'Troco' });
    recordCashMovement(database, { type: 'withdrawal', amountCents: 250, note: 'Sangria' });

    expect(getCashState(database)).toMatchObject({
      salesByMethod: {
        cashCents: 1000,
        pixCents: 500,
        creditCardCents: 0,
        debitCardCents: 0,
        voucherCents: 500,
      },
      grossSalesCents: 2000,
      activeExpensesCents: 500,
      cashExpensesCents: 300,
      expectedCashCents: 1850,
      projectedResultCents: 1500,
    });
    database.close();
  });

  it('fecha com diferença e preserva os valores apurados', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento fechamento', startsAt: Date.now() });
    openCashRegister(database, 500);
    recordCashMovement(database, { type: 'supply', amountCents: 200 });
    const closed = closeCashRegister(database, 650);

    expect(closed.register).toMatchObject({
      status: 'closed',
      expectedCashCents: 700,
      countedCashCents: 650,
      varianceCents: -50,
    });
    expect(() => recordCashMovement(database, { type: 'withdrawal', amountCents: 50 })).toThrow(
      'O caixa deste evento já foi fechado.',
    );
    database.close();
  });

  it('bloqueia fechamento enquanto houver comanda aberta', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento comanda aberta', startsAt: Date.now() });
    const productId = seedProduct(database);
    openCashRegister(database, 0);
    createOrder(database, productId);

    expect(() => closeCashRegister(database, 0)).toThrow('Existem 1 comandas abertas no evento.');
    expect(getCashState(database).register?.status).toBe('open');
    database.close();
  });

  it('edita despesa sem reescrever parcelas e impede total abaixo do já pago', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento edição', startsAt: Date.now() });
    const expense = createExpense(database, {
      category: 'Fornecedor',
      description: 'Estrutura inicial',
      amountCents: 1000,
      initialPaymentCents: 400,
      paymentMethod: 'pix',
      note: 'Versão inicial',
    });
    const paymentId = expense.payments[0]?.id;

    if (paymentId === undefined) {
      throw new Error('Parcela inicial não encontrada.');
    }

    const updated = updateExpense(database, {
      expenseId: expense.id,
      category: 'Estrutura',
      description: 'Estrutura revisada',
      amountCents: 1200,
      note: 'Contrato revisado',
    });

    expect(updated).toMatchObject({
      category: 'Estrutura',
      description: 'Estrutura revisada',
      totalCents: 1200,
      paidCents: 400,
      pendingCents: 800,
      status: 'partial',
      note: 'Contrato revisado',
    });
    expect(updated.payments[0]?.id).toBe(paymentId);
    expect(() =>
      updateExpense(database, {
        expenseId: expense.id,
        category: 'Estrutura',
        description: 'Valor inválido',
        amountCents: 300,
      }),
    ).toThrow('O valor total não pode ficar abaixo do valor já pago.');

    const audit = database.sqlite
      .prepare(
        `SELECT before_json, after_json
         FROM audit_log
         WHERE action = 'expense.updated' AND entity_id = ?
         ORDER BY id DESC LIMIT 1`,
      )
      .get(expense.id) as { readonly before_json: string; readonly after_json: string } | undefined;
    expect(JSON.parse(audit?.before_json ?? '{}')).toMatchObject({ totalCents: 1000 });
    expect(JSON.parse(audit?.after_json ?? '{}')).toMatchObject({
      totalCents: 1200,
      paidCents: 400,
      pendingCents: 800,
    });
    database.close();
  });

  it('pré-visualiza e cancela despesa estornando parcelas com correlação única', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento cancelamento', startsAt: Date.now() });
    openCashRegister(database, 1000);
    const expense = createExpense(database, {
      category: 'Equipe',
      description: 'Alimentação',
      amountCents: 800,
      initialPaymentCents: 300,
      paymentMethod: 'cash',
      note: 'Plantão',
    });
    payExpense(database, {
      expenseId: expense.id,
      amountCents: 200,
      paymentMethod: 'pix',
    });

    expect(getCashState(database)).toMatchObject({
      activeExpensesCents: 800,
      cashExpensesCents: 300,
      expectedCashCents: 700,
    });

    const preview = previewCancelExpense(database, { expenseId: expense.id });
    expect(preview).toMatchObject({
      totalCents: 800,
      paidCents: 500,
      pendingCents: 300,
      activePaymentCount: 2,
      refundTotalCents: 500,
      refundCashCents: 300,
      refundDigitalCents: 200,
    });

    const cancelled = cancelExpense(database, {
      expenseId: expense.id,
      reason: 'Fornecedor devolveu os valores',
    });
    expect(cancelled).toMatchObject({
      id: expense.id,
      status: 'cancelled',
      paidCents: 0,
      pendingCents: 0,
    });
    expect(cancelled.payments.every((payment) => payment.status === 'refunded')).toBe(true);
    expect(getCashState(database)).toMatchObject({
      activeExpensesCents: 0,
      cashExpensesCents: 0,
      expectedCashCents: 1000,
    });

    const auditRows = database.sqlite
      .prepare(
        `SELECT action, correlation_id
         FROM audit_log
         WHERE correlation_id = (
           SELECT correlation_id FROM audit_log
           WHERE action = 'expense.cancelled' AND entity_id = ?
           ORDER BY id DESC LIMIT 1
         )
         ORDER BY id`,
      )
      .all(expense.id) as { readonly action: string; readonly correlation_id: string | null }[];
    const correlationIds = new Set(auditRows.map((row) => row.correlation_id));
    expect(correlationIds.size).toBe(1);
    expect(auditRows.filter((row) => row.action === 'expense.payment-refunded-by-cancellation')).toHaveLength(2);
    expect(() => previewCancelExpense(database, { expenseId: expense.id })).toThrow(
      'Esta despesa já foi cancelada.',
    );
    database.close();
  });

  it('controla despesa aberta, pagamento parcial e estorno individual de parcela', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento parcelas', startsAt: Date.now() });
    const expense = createExpense(database, {
      category: 'Fornecedor',
      description: 'Som',
      amountCents: 1000,
      initialPaymentCents: 0,
      paymentMethod: 'pix',
    });

    expect(expense).toMatchObject({
      status: 'open',
      paidCents: 0,
      pendingCents: 1000,
    });
    expect(getCashState(database)).toMatchObject({
      activeExpensesCents: 1000,
      cashExpensesCents: 0,
      projectedResultCents: -1000,
    });

    const partial = payExpense(database, {
      expenseId: expense.id,
      amountCents: 400,
      paymentMethod: 'pix',
      note: 'Entrada',
    });

    expect(partial).toMatchObject({
      status: 'partial',
      paidCents: 400,
      pendingCents: 600,
    });

    const paid = payExpense(database, {
      expenseId: expense.id,
      amountCents: 600,
      paymentMethod: 'cash',
    });

    expect(paid).toMatchObject({
      status: 'paid',
      paidCents: 1000,
      pendingCents: 0,
    });

    const firstPayment = paid.payments.find((payment) => payment.amountCents === 400);

    if (firstPayment === undefined) {
      throw new Error('Parcela inicial não encontrada.');
    }

    const refunded = refundExpensePayment(database, {
      paymentId: firstPayment.id,
      reason: 'Pagamento duplicado',
    });

    expect(refunded).toMatchObject({
      status: 'partial',
      paidCents: 600,
      pendingCents: 400,
    });
    expect(getCashState(database)).toMatchObject({
      activeExpensesCents: 1000,
      cashExpensesCents: 600,
      projectedResultCents: -1000,
    });
    expect(() =>
      refundExpensePayment(database, {
        paymentId: firstPayment.id,
        reason: 'Repetido',
      }),
    ).toThrow('Este pagamento de despesa já foi estornado.');
    database.close();
  });

  it('restringe toda a administração financeira no perfil Caixa', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento perfil Caixa', startsAt: Date.now() });
    const expense = createExpense(database, {
      category: 'Permitida antes',
      description: 'Despesa de teste',
      amountCents: 100,
      initialPaymentCents: 0,
      paymentMethod: 'cash',
    });
    switchProfile(database, 'cashier');

    expect(() => openCashRegister(database, 0)).toThrow(
      'A administração do caixa exige o perfil Produção.',
    );
    expect(() =>
      createExpense(database, {
        category: 'Proibida',
        description: 'Despesa proibida',
        amountCents: 100,
        paymentMethod: 'cash',
      }),
    ).toThrow('A administração de despesas exige o perfil Produção.');
    expect(() =>
      updateExpense(database, {
        expenseId: expense.id,
        category: 'Proibida',
        description: 'Edição proibida',
        amountCents: 100,
      }),
    ).toThrow('A administração de despesas exige o perfil Produção.');
    expect(() => previewCancelExpense(database, { expenseId: expense.id })).toThrow(
      'A administração de despesas exige o perfil Produção.',
    );
    database.close();
  });
});
