import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  appendAudit,
  createEvent,
  createInventoryProduct,
  createProductCategory,
  getAuditState,
  getDashboardState,
  openDatabase,
  recordStockMovement,
  switchProfile,
  type DatabaseContext,
} from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-insights-'));
  return openDatabase(path.join(temporaryDirectory, 'insights.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

describe('dashboard and audit database', () => {
  it('consolida evento, estoque e atividade recente sem duplicar regras', async () => {
    const database = await createTemporaryDatabase();
    const event = createEvent(database, { name: 'Evento consolidado', startsAt: Date.now() });
    const category = createProductCategory(database, 'Bebidas consolidadas');
    const product = createInventoryProduct(database, {
      categoryId: category.id,
      name: 'Água consolidada',
      kind: 'drink',
      costCents: 200,
      salePriceCents: 500,
      lowStockThreshold: 5,
    });
    recordStockMovement(database, {
      productId: product.id,
      type: 'purchase',
      quantity: 3,
    });

    const dashboard = getDashboardState(database);

    expect(dashboard.activeEvent).toMatchObject({ id: event.id, name: 'Evento consolidado' });
    expect(dashboard.inventory).toEqual({
      units: 3,
      activeProducts: 1,
      lowStockProducts: 1,
      stockCostCents: 600,
    });
    expect(dashboard.grossSalesCents).toBe(0);
    expect(dashboard.recentActivity.length).toBeGreaterThan(0);
    database.close();
  });

  it('filtra a auditoria por conteúdo, evento, perfil e período', async () => {
    const database = await createTemporaryDatabase();
    const event = createEvent(database, { name: 'Evento pesquisável', startsAt: Date.now() });
    const before = Date.now();
    appendAudit(database, {
      action: 'test.searchable',
      entityType: 'test-record',
      entityId: 'registro-1',
      eventId: event.id,
      details: { marker: 'agulha-especial' },
      correlationId: 'corr-auditoria-1',
      before: { status: 'draft' },
      after: { status: 'done' },
      impact: { amountCents: 1200 },
      metadata: { source: 'spec' },
    });
    const after = Date.now();

    const state = getAuditState(database, {
      eventId: event.id,
      profile: 'production',
      action: 'test.searchable',
      entityType: 'test-record',
      entityId: 'registro-1',
      correlationId: 'corr-auditoria-1',
      search: 'agulha-especial',
      from: before,
      to: after,
      limit: 10,
    });

    expect(state.records).toHaveLength(1);
    expect(state.records[0]).toMatchObject({
      eventName: 'Evento pesquisável',
      action: 'test.searchable',
      entityId: 'registro-1',
      correlationId: 'corr-auditoria-1',
      details: { marker: 'agulha-especial' },
      before: { status: 'draft' },
      after: { status: 'done' },
      impact: { amountCents: 1200 },
      metadata: { source: 'spec' },
    });
    expect(state.pagination).toMatchObject({ limit: 10, offset: 0, total: 1, hasMore: false });
    expect(state.actions).toContain('test.searchable');
    expect(state.events).toContainEqual({ id: event.id, name: 'Evento pesquisável' });
    database.close();
  });

  it('pagina auditoria no banco mantendo ordenação do mais recente', async () => {
    const database = await createTemporaryDatabase();
    const event = createEvent(database, { name: 'Evento paginado', startsAt: Date.now() });

    appendAudit(database, {
      action: 'test.pageable',
      entityType: 'voucher',
      entityId: 'primeiro',
      eventId: event.id,
      details: { code: 'PAG-1' },
    });
    appendAudit(database, {
      action: 'test.pageable',
      entityType: 'voucher',
      entityId: 'segundo',
      eventId: event.id,
      details: { code: 'PAG-2' },
    });
    appendAudit(database, {
      action: 'test.pageable',
      entityType: 'voucher',
      entityId: 'terceiro',
      eventId: event.id,
      details: { code: 'PAG-3' },
    });

    const firstPage = getAuditState(database, {
      action: 'test.pageable',
      limit: 2,
      offset: 0,
    });
    const secondPage = getAuditState(database, {
      action: 'test.pageable',
      limit: 2,
      offset: firstPage.pagination.nextOffset ?? 0,
    });

    expect(firstPage.records.map((record) => record.entityId)).toEqual(['terceiro', 'segundo']);
    expect(firstPage.pagination).toEqual({
      limit: 2,
      offset: 0,
      total: 3,
      hasMore: true,
      nextOffset: 2,
    });
    expect(secondPage.records.map((record) => record.entityId)).toEqual(['primeiro']);
    expect(secondPage.pagination.hasMore).toBe(false);
    database.close();
  });

  it('protege indicadores financeiros e auditoria no perfil Caixa', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento protegido', startsAt: Date.now() });
    switchProfile(database, 'cashier');

    expect(() => getDashboardState(database)).toThrow(
      'A visão consolidada e a auditoria exigem o perfil Produção.',
    );
    expect(() => getAuditState(database)).toThrow(
      'A visão consolidada e a auditoria exigem o perfil Produção.',
    );
    database.close();
  });
});
