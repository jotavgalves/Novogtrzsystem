import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  changeEventStatus,
  createEvent,
  createInventoryProduct,
  createProductCategory,
  createVoucher,
  openDatabase,
  recordStockMovement,
  redeemVouchers,
  setActiveEvent,
  switchProfile,
  type DatabaseContext,
} from './index';
import { isDatabaseError } from './database-error';
import { requireAvailableCatalogItem } from './operation-stock';
import { requireTicketLot, requireTicketProduction } from './ticket-repository';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-domain-errors-'));
  return openDatabase(path.join(temporaryDirectory, 'domain-errors.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

function expectDatabaseError(
  operation: () => unknown,
  expectedCode:
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'INVALID_STATE'
    | 'INSUFFICIENT_STOCK'
    | 'INSUFFICIENT_BALANCE',
): Readonly<Record<string, unknown>> | null {
  try {
    operation();
  } catch (error: unknown) {
    expect(isDatabaseError(error)).toBe(true);

    if (isDatabaseError(error)) {
      expect(error.code).toBe(expectedCode);
      return error.details;
    }
  }

  throw new Error(`A operação deveria falhar com ${expectedCode}.`);
}

describe('stable domain error codes', () => {
  it('distingue permissão e entidade inexistente sem interpretar mensagem', async () => {
    const database = await createTemporaryDatabase();
    const event = createEvent(database, { name: 'Evento erros', startsAt: Date.now() });

    expect(
      expectDatabaseError(() => requireTicketLot(database, event.id, 'missing'), 'NOT_FOUND'),
    ).toEqual({ eventId: event.id, lotId: 'missing' });

    switchProfile(database, 'cashier');
    expect(expectDatabaseError(() => requireTicketProduction(database), 'FORBIDDEN')).toEqual({
      requiredProfile: 'production',
    });
    database.close();
  });

  it('transporta saldo de estoque disponível e quantidade solicitada como dados', async () => {
    const database = await createTemporaryDatabase();
    const event = createEvent(database, { name: 'Evento estoque tipado', startsAt: Date.now() });
    const category = createProductCategory(database, 'Estoque tipado');
    const product = createInventoryProduct(database, {
      categoryId: category.id,
      name: 'Produto limitado',
      kind: 'drink',
      costCents: 100,
      salePriceCents: 300,
      lowStockThreshold: 1,
    });
    recordStockMovement(database, { productId: product.id, type: 'purchase', quantity: 1 });

    expect(
      expectDatabaseError(
        () => requireAvailableCatalogItem(database, event.id, 'product', product.id, 2),
        'INSUFFICIENT_STOCK',
      ),
    ).toMatchObject({
      eventId: event.id,
      itemKind: 'product',
      itemId: product.id,
      requestedQuantity: 2,
      availableQuantity: 1,
    });
    database.close();
  });

  it('expõe saldo de voucher insuficiente sem analisar a mensagem formatada', async () => {
    const database = await createTemporaryDatabase();
    const event = createEvent(database, { name: 'Evento voucher tipado', startsAt: Date.now() });
    const voucher = createVoucher(database, {
      code: 'SALDO-200',
      label: 'Saldo limitado',
      initialBalanceCents: 200,
    });

    expect(
      expectDatabaseError(
        () =>
          redeemVouchers(
            database,
            event.id,
            'ordem-ainda-nao-persistida',
            [{ code: voucher.code, amountCents: 300 }],
            Date.now(),
          ),
        'INSUFFICIENT_BALANCE',
      ),
    ).toMatchObject({
      voucherId: voucher.id,
      code: voucher.code,
      requestedCents: 300,
      availableCents: 200,
    });
    database.close();
  });

  it('tipa evento ausente e estado não operacional sem depender de texto', async () => {
    const database = await createTemporaryDatabase();
    const event = createEvent(database, { name: 'Evento arquivado', startsAt: Date.now() });

    expect(
      expectDatabaseError(() => setActiveEvent(database, 'missing-event'), 'NOT_FOUND'),
    ).toEqual({ eventId: 'missing-event' });

    changeEventStatus(database, { eventId: event.id, status: 'archived' });
    expect(expectDatabaseError(() => setActiveEvent(database, event.id), 'INVALID_STATE')).toEqual({
      eventId: event.id,
      status: 'archived',
      requiredStatus: 'open',
    });
    database.close();
  });

  it('tipa senha inválida ao retornar ao perfil Produção', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento perfil', startsAt: Date.now() });
    switchProfile(database, 'cashier');

    expect(
      expectDatabaseError(() => switchProfile(database, 'production', 'senha-errada'), 'FORBIDDEN'),
    ).toEqual({
      targetProfile: 'production',
      reason: 'invalid-production-password',
    });
    database.close();
  });
});
