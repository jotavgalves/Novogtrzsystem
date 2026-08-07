import { randomUUID } from 'node:crypto';

import { appendAudit } from './audit';
import { getSessionState } from './control';
import type { DatabaseContext } from './types';

export type DatabaseProductKind = 'food' | 'drink';
export type DatabaseStockMovementType =
  | 'purchase'
  | 'correction-positive'
  | 'correction-negative'
  | 'loss'
  | 'breakage'
  | 'internal-consumption'
  | 'courtesy'
  | 'return';

export interface DatabaseProductCategory {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface DatabaseProductFinancials {
  readonly costCents: number;
  readonly grossProfitCents: number;
  readonly marginPercent: number;
}

export interface DatabaseInventoryProduct {
  readonly id: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly name: string;
  readonly kind: DatabaseProductKind;
  readonly salePriceCents: number;
  readonly lowStockThreshold: number;
  readonly active: boolean;
  readonly quantity: number;
  readonly lowStock: boolean;
  readonly financials: DatabaseProductFinancials | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface DatabaseInventoryState {
  readonly activeEventId: string | null;
  readonly categories: readonly DatabaseProductCategory[];
  readonly products: readonly DatabaseInventoryProduct[];
}

interface CategoryRow {
  readonly id: string;
  readonly name: string;
  readonly active: number;
  readonly created_at: number;
  readonly updated_at: number;
}

interface ProductRow {
  readonly id: string;
  readonly category_id: string;
  readonly category_name: string;
  readonly name: string;
  readonly kind: DatabaseProductKind;
  readonly cost_cents: number;
  readonly sale_price_cents: number;
  readonly low_stock_threshold: number;
  readonly active: number;
  readonly quantity: number;
  readonly created_at: number;
  readonly updated_at: number;
}

interface ProductWriteInput {
  readonly categoryId: string;
  readonly name: string;
  readonly kind: DatabaseProductKind;
  readonly costCents: number;
  readonly salePriceCents: number;
  readonly lowStockThreshold: number;
}

const POSITIVE_MOVEMENTS = new Set<DatabaseStockMovementType>([
  'purchase',
  'correction-positive',
  'return',
]);

function requireProduction(database: DatabaseContext): void {
  if (getSessionState(database).profile !== 'production') {
    throw new Error('Esta operação de estoque exige o perfil Produção.');
  }
}

function requireActiveEvent(database: DatabaseContext): string {
  const event = getSessionState(database).activeEvent;

  if (event === null) {
    throw new Error('Selecione um evento aberto antes de movimentar o estoque.');
  }

  return event.id;
}

function calculateFinancials(costCents: number, salePriceCents: number): DatabaseProductFinancials {
  const grossProfitCents = salePriceCents - costCents;
  const marginPercent =
    salePriceCents === 0 ? 0 : Math.round((grossProfitCents / salePriceCents) * 10_000) / 100;

  return { costCents, grossProfitCents, marginPercent };
}

function mapCategory(row: CategoryRow): DatabaseProductCategory {
  return {
    id: row.id,
    name: row.name,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProduct(
  row: ProductRow,
  showFinancials: boolean,
  hasActiveEvent: boolean,
): DatabaseInventoryProduct {
  const quantity = row.quantity;

  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    name: row.name,
    kind: row.kind,
    salePriceCents: row.sale_price_cents,
    lowStockThreshold: row.low_stock_threshold,
    active: row.active === 1,
    quantity,
    lowStock: hasActiveEvent && quantity <= row.low_stock_threshold,
    financials: showFinancials ? calculateFinancials(row.cost_cents, row.sale_price_cents) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function listCategories(database: DatabaseContext): readonly DatabaseProductCategory[] {
  const rows = database.sqlite
    .prepare(
      `SELECT id, name, active, created_at, updated_at
       FROM product_categories
       ORDER BY active DESC, name COLLATE NOCASE`,
    )
    .all() as CategoryRow[];
  return rows.map(mapCategory);
}

function listProducts(
  database: DatabaseContext,
  eventId: string | null,
): readonly DatabaseInventoryProduct[] {
  const rows = database.sqlite
    .prepare(
      `SELECT
         p.id,
         p.category_id,
         c.name AS category_name,
         p.name,
         p.kind,
         p.cost_cents,
         p.sale_price_cents,
         p.low_stock_threshold,
         p.active,
         COALESCE(es.quantity, 0) AS quantity,
         p.created_at,
         p.updated_at
       FROM products p
       INNER JOIN product_categories c ON c.id = p.category_id
       LEFT JOIN event_stock es ON es.product_id = p.id AND es.event_id = ?
       ORDER BY p.active DESC, c.name COLLATE NOCASE, p.name COLLATE NOCASE`,
    )
    .all(eventId) as ProductRow[];
  const showFinancials = getSessionState(database).profile === 'production';
  return rows.map((row) => mapProduct(row, showFinancials, eventId !== null));
}

function requireCategory(database: DatabaseContext, categoryId: string): DatabaseProductCategory {
  const row = database.sqlite
    .prepare(
      `SELECT id, name, active, created_at, updated_at
       FROM product_categories WHERE id = ?`,
    )
    .get(categoryId) as CategoryRow | undefined;

  if (row === undefined) {
    throw new Error('A categoria informada não existe.');
  }

  return mapCategory(row);
}

function requireProductRow(database: DatabaseContext, productId: string): ProductRow {
  const row = database.sqlite
    .prepare(
      `SELECT
         p.id,
         p.category_id,
         c.name AS category_name,
         p.name,
         p.kind,
         p.cost_cents,
         p.sale_price_cents,
         p.low_stock_threshold,
         p.active,
         0 AS quantity,
         p.created_at,
         p.updated_at
       FROM products p
       INNER JOIN product_categories c ON c.id = p.category_id
       WHERE p.id = ?`,
    )
    .get(productId) as ProductRow | undefined;

  if (row === undefined) {
    throw new Error('O produto informado não existe.');
  }

  return row;
}

function requireUniqueName(
  database: DatabaseContext,
  table: 'product_categories' | 'products',
  name: string,
  excludedId?: string,
): void {
  const row = database.sqlite
    .prepare(
      `SELECT id FROM ${table}
       WHERE name = ? COLLATE NOCASE
         AND (? IS NULL OR id != ?)`,
    )
    .get(name, excludedId ?? null, excludedId ?? null) as { readonly id: string } | undefined;

  if (row !== undefined) {
    throw new Error(
      table === 'products' ? 'Já existe um produto com esse nome.' : 'Já existe essa categoria.',
    );
  }
}

export function getProduct(
  database: DatabaseContext,
  productId: string,
  eventId: string | null,
): DatabaseInventoryProduct {
  const product = listProducts(database, eventId).find((item) => item.id === productId);

  if (product === undefined) {
    throw new Error('O produto informado não existe.');
  }

  return product;
}

export function getInventoryState(database: DatabaseContext): DatabaseInventoryState {
  const activeEventId = getSessionState(database).activeEvent?.id ?? null;
  return {
    activeEventId,
    categories: listCategories(database),
    products: listProducts(database, activeEventId),
  };
}

export function createProductCategory(
  database: DatabaseContext,
  nameInput: string,
): DatabaseProductCategory {
  requireProduction(database);
  const name = nameInput.trim();
  requireUniqueName(database, 'product_categories', name);
  const id = randomUUID();
  const now = Date.now();

  database.sqlite.transaction(() => {
    database.sqlite
      .prepare(
        `INSERT INTO product_categories (id, name, active, created_at, updated_at)
         VALUES (?, ?, 1, ?, ?)`,
      )
      .run(id, name, now, now);
    appendAudit(database, {
      action: 'inventory.category-created',
      entityType: 'product-category',
      entityId: id,
      details: { name },
    });
  })();

  return requireCategory(database, id);
}

export function createInventoryProduct(
  database: DatabaseContext,
  input: ProductWriteInput,
): DatabaseInventoryProduct {
  requireProduction(database);
  const category = requireCategory(database, input.categoryId);

  if (!category.active) {
    throw new Error('Não é possível cadastrar produto em uma categoria inativa.');
  }

  const name = input.name.trim();
  requireUniqueName(database, 'products', name);
  const id = randomUUID();
  const now = Date.now();

  database.sqlite.transaction(() => {
    database.sqlite
      .prepare(
        `INSERT INTO products
         (id, category_id, name, kind, cost_cents, sale_price_cents,
          low_stock_threshold, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(
        id,
        input.categoryId,
        name,
        input.kind,
        input.costCents,
        input.salePriceCents,
        input.lowStockThreshold,
        now,
        now,
      );
    appendAudit(database, {
      action: 'inventory.product-created',
      entityType: 'product',
      entityId: id,
      details: {
        categoryId: input.categoryId,
        costCents: input.costCents,
        kind: input.kind,
        lowStockThreshold: input.lowStockThreshold,
        name,
        salePriceCents: input.salePriceCents,
      },
    });
  })();

  return getProduct(database, id, getSessionState(database).activeEvent?.id ?? null);
}

export function updateInventoryProduct(
  database: DatabaseContext,
  input: ProductWriteInput & { readonly productId: string; readonly active: boolean },
): DatabaseInventoryProduct {
  requireProduction(database);
  const current = requireProductRow(database, input.productId);
  const category = requireCategory(database, input.categoryId);

  if (!category.active) {
    throw new Error('Não é possível mover o produto para uma categoria inativa.');
  }

  const name = input.name.trim();
  requireUniqueName(database, 'products', name, input.productId);
  const now = Date.now();

  database.sqlite.transaction(() => {
    database.sqlite
      .prepare(
        `UPDATE products
         SET category_id = ?, name = ?, kind = ?, cost_cents = ?, sale_price_cents = ?,
             low_stock_threshold = ?, active = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.categoryId,
        name,
        input.kind,
        input.costCents,
        input.salePriceCents,
        input.lowStockThreshold,
        input.active ? 1 : 0,
        now,
        input.productId,
      );
    appendAudit(database, {
      action: 'inventory.product-updated',
      entityType: 'product',
      entityId: input.productId,
      details: {
        before: {
          categoryId: current.category_id,
          costCents: current.cost_cents,
          kind: current.kind,
          lowStockThreshold: current.low_stock_threshold,
          name: current.name,
          salePriceCents: current.sale_price_cents,
        },
        after: { ...input, name },
      },
    });
  })();

  return getProduct(database, input.productId, getSessionState(database).activeEvent?.id ?? null);
}

export function recordStockMovement(
  database: DatabaseContext,
  input: {
    readonly productId: string;
    readonly type: DatabaseStockMovementType;
    readonly quantity: number;
    readonly note?: string;
  },
): DatabaseInventoryProduct {
  requireProduction(database);
  requireProductRow(database, input.productId);
  const eventId = requireActiveEvent(database);
  const delta = POSITIVE_MOVEMENTS.has(input.type) ? input.quantity : -input.quantity;
  const currentRow = database.sqlite
    .prepare('SELECT quantity FROM event_stock WHERE event_id = ? AND product_id = ?')
    .get(eventId, input.productId) as { readonly quantity: number } | undefined;
  const currentQuantity = currentRow?.quantity ?? 0;
  const nextQuantity = currentQuantity + delta;

  if (nextQuantity < 0) {
    throw new Error(`Estoque insuficiente. Saldo atual: ${String(currentQuantity)}.`);
  }

  const movementId = randomUUID();
  const now = Date.now();
  const trimmedNote = input.note?.trim();
  const note = trimmedNote === undefined || trimmedNote.length === 0 ? null : trimmedNote;

  database.sqlite.transaction(() => {
    database.sqlite
      .prepare(
        `INSERT INTO event_stock (event_id, product_id, quantity, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(event_id, product_id)
         DO UPDATE SET quantity = excluded.quantity, updated_at = excluded.updated_at`,
      )
      .run(eventId, input.productId, nextQuantity, now);
    database.sqlite
      .prepare(
        `INSERT INTO stock_movements
         (id, event_id, product_id, type, quantity, delta, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(movementId, eventId, input.productId, input.type, input.quantity, delta, note, now);
    appendAudit(database, {
      action: 'inventory.stock-moved',
      entityType: 'stock-movement',
      entityId: movementId,
      eventId,
      details: {
        afterQuantity: nextQuantity,
        beforeQuantity: currentQuantity,
        delta,
        note,
        productId: input.productId,
        type: input.type,
      },
    });
  })();

  return getProduct(database, input.productId, eventId);
}
