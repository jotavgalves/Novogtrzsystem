import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import BetterSqlite3 from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createEvent,
  createExpense,
  createInventoryProduct,
  createProductCategory,
  createTicketLot,
  createTicketSale,
  createVoucher,
  getExpenseState,
  getInventoryState,
  getTicketState,
  getVoucherState,
  listEvents,
  openDatabase,
  payExpense,
  recordStockMovement,
  verifyDatabaseIntegrity,
  type DatabaseContext,
} from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryPath(): Promise<string> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-migration-upgrade-'));
  return path.join(temporaryDirectory, 'legacy.sqlite');
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

function dropIndexesUsingColumn(
  sqlite: BetterSqlite3.Database,
  table: string,
  column: string,
): void {
  const indexes = sqlite
    .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ?")
    .all(table) as { readonly name: string; readonly sql: string | null }[];

  for (const index of indexes) {
    if (index.sql?.includes(column) === true) {
      sqlite.exec(`DROP INDEX "${index.name.replaceAll('"', '""')}"`);
    }
  }
}

function downgradeToVersion11(filePath: string): void {
  const sqlite = new BetterSqlite3(filePath);
  sqlite.pragma('foreign_keys = OFF');
  sqlite.exec('DROP TABLE IF EXISTS expense_payments;');

  for (const column of [
    'actor_identifier',
    'correlation_id',
    'before_json',
    'after_json',
    'impact_json',
    'metadata_json',
  ]) {
    dropIndexesUsingColumn(sqlite, 'audit_log', column);
    sqlite.exec(`ALTER TABLE audit_log DROP COLUMN ${column};`);
  }

  dropIndexesUsingColumn(sqlite, 'events', 'deleted_at');
  sqlite.exec('ALTER TABLE events DROP COLUMN deleted_at;');
  sqlite.prepare('DELETE FROM schema_migrations WHERE version >= 12').run();
  sqlite.close();
}

function migrationState(database: DatabaseContext): {
  readonly count: number;
  readonly max: number;
} {
  return database.sqlite
    .prepare('SELECT COUNT(*) AS count, MAX(version) AS max FROM schema_migrations')
    .get() as { readonly count: number; readonly max: number };
}

describe('upgrade from previous database schema', () => {
  it('migra schema 11, preserva entidades e não reaplica migrations no segundo boot', async () => {
    const filePath = await createTemporaryPath();
    const seeded = openDatabase(filePath);
    const event = createEvent(seeded, { name: 'Evento legado preservado', startsAt: Date.now() });
    const category = createProductCategory(seeded, 'Legado');
    const product = createInventoryProduct(seeded, {
      categoryId: category.id,
      name: 'Produto legado',
      kind: 'drink',
      costCents: 200,
      salePriceCents: 500,
      lowStockThreshold: 1,
    });
    recordStockMovement(seeded, { productId: product.id, type: 'purchase', quantity: 7 });
    const voucher = createVoucher(seeded, {
      code: 'LEGADO-01',
      label: 'Voucher legado',
      initialBalanceCents: 1500,
    });
    const lot = createTicketLot(seeded, {
      name: 'Lote legado',
      priceCents: 3000,
      capacity: 5,
    });
    const ticketSale = createTicketSale(seeded, {
      lotId: lot.id,
      attendeeName: 'Cliente legado',
      source: 'door',
      quantity: 1,
      paymentMethod: 'pix',
    });
    const expense = createExpense(seeded, {
      category: 'Estrutura',
      description: 'Despesa legada',
      amountCents: 1000,
      paymentMethod: 'cash',
    });
    seeded.close();

    downgradeToVersion11(filePath);

    const upgraded = openDatabase(filePath);
    expect(verifyDatabaseIntegrity(upgraded)).toBe(true);
    expect(migrationState(upgraded)).toEqual({ count: 14, max: 14 });
    expect(listEvents(upgraded).map((item) => item.id)).toContain(event.id);
    expect(
      getInventoryState(upgraded).products.find((item) => item.id === product.id),
    ).toMatchObject({
      name: 'Produto legado',
      quantity: 7,
    });
    expect(getVoucherState(upgraded).vouchers.find((item) => item.id === voucher.id)).toMatchObject(
      {
        code: 'LEGADO-01',
        remainingBalanceCents: 1500,
      },
    );
    expect(getTicketState(upgraded).sales.find((item) => item.id === ticketSale.id)).toMatchObject({
      attendeeName: 'Cliente legado',
      quantity: 1,
      totalCents: 3000,
    });
    const migratedExpense = getExpenseState(upgraded).expenses.find(
      (item) => item.id === expense.id,
    );
    expect(migratedExpense).toMatchObject({
      description: 'Despesa legada',
      totalCents: 1000,
      paidCents: 1000,
      pendingCents: 0,
      status: 'paid',
    });
    expect(migratedExpense?.payments).toHaveLength(1);

    const newExpense = createExpense(upgraded, {
      category: 'Operação nova',
      description: 'Despesa após upgrade',
      amountCents: 800,
      initialPaymentCents: 0,
      paymentMethod: 'pix',
    });
    expect(
      payExpense(upgraded, {
        expenseId: newExpense.id,
        amountCents: 300,
        paymentMethod: 'pix',
      }),
    ).toMatchObject({ status: 'partial', paidCents: 300, pendingCents: 500 });
    upgraded.close();

    const reopened = openDatabase(filePath);
    expect(verifyDatabaseIntegrity(reopened)).toBe(true);
    expect(migrationState(reopened)).toEqual({ count: 14, max: 14 });
    const paymentCount = reopened.sqlite
      .prepare('SELECT COUNT(*) AS value FROM expense_payments WHERE expense_id = ?')
      .get(expense.id) as { readonly value: number };
    expect(paymentCount.value).toBe(1);
    expect(
      getExpenseState(reopened).expenses.find((item) => item.id === newExpense.id),
    ).toMatchObject({
      status: 'partial',
      paidCents: 300,
      pendingCents: 500,
    });
    reopened.close();
  });
});
