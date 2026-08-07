import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createCombo,
  createEvent,
  createInventoryProduct,
  createProductCategory,
  deleteProduct,
  getInventoryState,
  listCombos,
  openDatabase,
  previewDeleteProduct,
  recordStockMovement,
  setActiveEvent,
  switchProfile,
  type DatabaseContext,
} from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-inventory-'));
  return openDatabase(path.join(temporaryDirectory, 'inventory.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

function createCatalog(database: DatabaseContext): {
  readonly categoryId: string;
  readonly productId: string;
} {
  const category = createProductCategory(database, 'Cervejas');
  const product = createInventoryProduct(database, {
    categoryId: category.id,
    name: 'Budweiser lata',
    kind: 'drink',
    costCents: 600,
    salePriceCents: 1_000,
    lowStockThreshold: 3,
  });

  return { categoryId: category.id, productId: product.id };
}

describe('inventory database', () => {
  it('cadastra produto e calcula lucro e margem para Produção', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento Estoque', startsAt: Date.now() });
    const { productId } = createCatalog(database);
    const product = getInventoryState(database).products.find((item) => item.id === productId);

    expect(product).toMatchObject({
      name: 'Budweiser lata',
      quantity: 0,
      lowStock: true,
      financials: {
        costCents: 600,
        grossProfitCents: 400,
        marginPercent: 40,
      },
    });
    database.close();
  });

  it('registra razão imutável e atualiza o saldo sem permitir quantidade negativa', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento Estoque', startsAt: Date.now() });
    const { productId } = createCatalog(database);

    recordStockMovement(database, {
      productId,
      type: 'purchase',
      quantity: 10,
      note: 'Compra inicial',
    });
    const afterLoss = recordStockMovement(database, {
      productId,
      type: 'loss',
      quantity: 3,
      note: 'Latas avariadas',
    });

    expect(afterLoss.quantity).toBe(7);
    expect(() =>
      recordStockMovement(database, { productId, type: 'breakage', quantity: 8 }),
    ).toThrow('Estoque insuficiente. Saldo atual: 7.');
    expect(
      getInventoryState(database).products.find((item) => item.id === productId)?.quantity,
    ).toBe(7);

    const movements = database.sqlite
      .prepare(
        `SELECT type, quantity, delta, note
         FROM stock_movements
         WHERE product_id = ?
         ORDER BY created_at, rowid`,
      )
      .all(productId);

    expect(movements).toEqual([
      { type: 'purchase', quantity: 10, delta: 10, note: 'Compra inicial' },
      { type: 'loss', quantity: 3, delta: -3, note: 'Latas avariadas' },
    ]);
    database.close();
  });

  it('mantém saldos independentes para o mesmo produto em eventos diferentes', async () => {
    const database = await createTemporaryDatabase();
    const firstEvent = createEvent(database, { name: 'Primeiro evento', startsAt: Date.now() });
    const { productId } = createCatalog(database);
    recordStockMovement(database, { productId, type: 'purchase', quantity: 5 });

    const secondEvent = createEvent(database, {
      name: 'Segundo evento',
      startsAt: Date.now() + 86_400_000,
    });
    setActiveEvent(database, secondEvent.id);
    recordStockMovement(database, { productId, type: 'purchase', quantity: 2 });
    expect(
      getInventoryState(database).products.find((item) => item.id === productId)?.quantity,
    ).toBe(2);

    setActiveEvent(database, firstEvent.id);
    expect(
      getInventoryState(database).products.find((item) => item.id === productId)?.quantity,
    ).toBe(5);
    database.close();
  });

  it('exclui produto logicamente sem alterar estoque ou razão', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento exclusão produto', startsAt: Date.now() });
    const { productId } = createCatalog(database);
    recordStockMovement(database, { productId, type: 'purchase', quantity: 4 });

    expect(previewDeleteProduct(database, { productId })).toMatchObject({
      productId,
      activeEventStockQuantity: 4,
      historicalSales: 0,
      stockMovements: 1,
    });
    expect(() => deleteProduct(database, { productId, reason: '  ' })).toThrow(
      'Informe uma justificativa com pelo menos 3 caracteres.',
    );
    const deleted = deleteProduct(database, {
      productId,
      reason: 'Produto fora de catálogo',
    });

    expect(deleted).toMatchObject({ active: false, quantity: 4 });
    expect(
      getInventoryState(database).products.find((item) => item.id === productId),
    ).toMatchObject({
      active: false,
      quantity: 4,
    });
    expect(() =>
      deleteProduct(database, { productId, reason: 'Excluir novamente' }),
    ).toThrow('Este produto já está inativo.');
    database.close();
  });

  it('desativa combos dependentes na mesma transação da exclusão do produto', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento dependência combo', startsAt: Date.now() });
    const { productId } = createCatalog(database);
    const combo = createCombo(database, {
      name: 'Combo dependente',
      salePriceCents: 1800,
      components: [{ productId, quantity: 2 }],
    });

    expect(previewDeleteProduct(database, { productId }).dependentCombos).toEqual([
      'Combo dependente',
    ]);
    deleteProduct(database, {
      productId,
      reason: 'Produto descontinuado',
    });

    expect(listCombos(database).find((item) => item.id === combo.id)).toMatchObject({
      active: false,
      availableUnits: 0,
    });
    const auditRows = database.sqlite
      .prepare(
        `SELECT action, entity_id
         FROM audit_log
         WHERE action IN ('combo.deactivated-by-product-deletion', 'inventory.product-deleted')
         ORDER BY id`,
      )
      .all();
    expect(auditRows).toEqual([
      { action: 'combo.deactivated-by-product-deletion', entity_id: combo.id },
      { action: 'inventory.product-deleted', entity_id: productId },
    ]);
    database.close();
  });

  it('oculta custos para Caixa e bloqueia alterações administrativas', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento Caixa', startsAt: Date.now() });
    const { productId } = createCatalog(database);
    switchProfile(database, 'cashier');

    expect(
      getInventoryState(database).products.find((item) => item.id === productId)?.financials,
    ).toBe(null);
    expect(() => createProductCategory(database, 'Bloqueada')).toThrow(
      'Esta operação de estoque exige o perfil Produção.',
    );
    expect(() =>
      recordStockMovement(database, { productId, type: 'purchase', quantity: 1 }),
    ).toThrow('Esta operação de estoque exige o perfil Produção.');
    database.close();
  });
});
