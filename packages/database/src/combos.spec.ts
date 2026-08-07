import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createCombo,
  createEvent,
  createInventoryProduct,
  createProductCategory,
  deleteCombo,
  listCombos,
  openDatabase,
  previewDeleteCombo,
  recordStockMovement,
  switchProfile,
  updateCombo,
  type DatabaseContext,
} from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-combos-'));
  return openDatabase(path.join(temporaryDirectory, 'combos.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

function createProducts(database: DatabaseContext): {
  readonly beerId: string;
  readonly snackId: string;
} {
  const category = createProductCategory(database, 'Itens do combo');
  const beer = createInventoryProduct(database, {
    categoryId: category.id,
    name: 'Budweiser lata',
    kind: 'drink',
    costCents: 600,
    salePriceCents: 1_000,
    lowStockThreshold: 3,
  });
  const snack = createInventoryProduct(database, {
    categoryId: category.id,
    name: 'Porção individual',
    kind: 'food',
    costCents: 400,
    salePriceCents: 800,
    lowStockThreshold: 2,
  });

  return { beerId: beer.id, snackId: snack.id };
}

describe('combo database', () => {
  it('calcula custo, lucro, margem, economia e disponibilidade pelo item limitante', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento combos', startsAt: Date.now() });
    const { beerId, snackId } = createProducts(database);
    recordStockMovement(database, { productId: beerId, type: 'purchase', quantity: 7 });
    recordStockMovement(database, { productId: snackId, type: 'purchase', quantity: 2 });

    const combo = createCombo(database, {
      name: 'Combo 2 Bud + porção',
      salePriceCents: 2_500,
      components: [
        { productId: beerId, quantity: 2 },
        { productId: snackId, quantity: 1 },
      ],
    });

    expect(combo).toMatchObject({
      individualSaleTotalCents: 2_800,
      savingsCents: 300,
      availableUnits: 2,
      financials: {
        costCents: 1_600,
        grossProfitCents: 900,
        marginPercent: 36,
      },
    });
    database.close();
  });

  it('reflete alterações de estoque sem manter saldo próprio para o combo', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento combos', startsAt: Date.now() });
    const { beerId } = createProducts(database);
    recordStockMovement(database, { productId: beerId, type: 'purchase', quantity: 5 });
    const combo = createCombo(database, {
      name: 'Dupla Budweiser',
      salePriceCents: 1_800,
      components: [{ productId: beerId, quantity: 2 }],
    });

    expect(combo.availableUnits).toBe(2);
    recordStockMovement(database, { productId: beerId, type: 'loss', quantity: 2 });
    expect(listCombos(database).find((item) => item.id === combo.id)?.availableUnits).toBe(1);
    database.close();
  });

  it('atualiza composição e preserva histórico de auditoria', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento combos', startsAt: Date.now() });
    const { beerId, snackId } = createProducts(database);
    const combo = createCombo(database, {
      name: 'Combo inicial',
      salePriceCents: 1_800,
      components: [{ productId: beerId, quantity: 2 }],
    });

    const updated = updateCombo(database, {
      comboId: combo.id,
      name: 'Combo atualizado',
      salePriceCents: 2_300,
      active: false,
      components: [
        { productId: beerId, quantity: 1 },
        { productId: snackId, quantity: 1 },
      ],
    });

    expect(updated).toMatchObject({ name: 'Combo atualizado', active: false });
    expect(updated.components).toHaveLength(2);
    const actions = database.sqlite
      .prepare('SELECT action FROM audit_log WHERE entity_id = ? ORDER BY id')
      .all(combo.id);
    expect(actions).toEqual([{ action: 'combo.created' }, { action: 'combo.updated' }]);
    database.close();
  });

  it('exclui combo logicamente preservando composição histórica', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento exclusão combo', startsAt: Date.now() });
    const { beerId, snackId } = createProducts(database);
    const combo = createCombo(database, {
      name: 'Combo removível',
      salePriceCents: 2_000,
      components: [
        { productId: beerId, quantity: 1 },
        { productId: snackId, quantity: 1 },
      ],
    });

    expect(previewDeleteCombo(database, { comboId: combo.id })).toMatchObject({
      comboId: combo.id,
      active: true,
      components: [
        { productId: beerId, productName: 'Budweiser lata', quantity: 1 },
        { productId: snackId, productName: 'Porção individual', quantity: 1 },
      ],
      historicalSales: 0,
    });
    expect(() => deleteCombo(database, { comboId: combo.id, reason: '  ' })).toThrow(
      'Informe uma justificativa com pelo menos 3 caracteres.',
    );

    const deleted = deleteCombo(database, {
      comboId: combo.id,
      reason: 'Combo fora de catálogo',
    });

    expect(deleted).toMatchObject({ active: false });
    expect(deleted.components).toHaveLength(2);
    const stored = listCombos(database).find((item) => item.id === combo.id);
    expect(stored?.active).toBe(false);
    expect(stored?.components.map((component) => component.productId).sort()).toEqual(
      [beerId, snackId].sort(),
    );
    expect(() => deleteCombo(database, { comboId: combo.id, reason: 'Excluir novamente' })).toThrow(
      'Este combo já está inativo.',
    );
    database.close();
  });

  it('oculta custos no Caixa e bloqueia criação e edição', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento Caixa', startsAt: Date.now() });
    const { beerId } = createProducts(database);
    const combo = createCombo(database, {
      name: 'Combo protegido',
      salePriceCents: 1_800,
      components: [{ productId: beerId, quantity: 2 }],
    });
    switchProfile(database, 'cashier');

    expect(listCombos(database).find((item) => item.id === combo.id)?.financials).toBeNull();
    expect(() =>
      createCombo(database, {
        name: 'Combo bloqueado',
        salePriceCents: 1_000,
        components: [{ productId: beerId, quantity: 1 }],
      }),
    ).toThrow('Esta operação de combo exige o perfil Produção.');
    expect(() =>
      updateCombo(database, {
        comboId: combo.id,
        name: combo.name,
        salePriceCents: combo.salePriceCents,
        active: false,
        components: [{ productId: beerId, quantity: 2 }],
      }),
    ).toThrow('Esta operação de combo exige o perfil Produção.');
    database.close();
  });
});
