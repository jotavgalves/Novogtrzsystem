import { randomUUID } from 'node:crypto';

import { appendAudit } from './audit';
import { getSessionState } from './control';
import { getProduct, type DatabaseInventoryProduct } from './inventory';
import { requireOperationReason } from './operation-validation';
import type { DatabaseContext } from './types';

export interface DatabaseProductDeletePreview {
  readonly productId: string;
  readonly name: string;
  readonly active: boolean;
  readonly activeEventStockQuantity: number;
  readonly dependentCombos: readonly string[];
  readonly historicalSales: number;
  readonly stockMovements: number;
}

interface DependentComboRow {
  readonly id: string;
  readonly name: string;
}

function requireProduction(database: DatabaseContext): void {
  if (getSessionState(database).profile !== 'production') {
    throw new Error('A exclusão de produtos exige o perfil Produção.');
  }
}

function listActiveDependentCombos(
  database: DatabaseContext,
  productId: string,
): readonly DependentComboRow[] {
  return database.sqlite
    .prepare(
      `SELECT c.id, c.name
       FROM combo_components cc
       INNER JOIN combos c ON c.id = cc.combo_id
       WHERE cc.product_id = ? AND c.active = 1
       ORDER BY c.name COLLATE NOCASE`,
    )
    .all(productId) as DependentComboRow[];
}

export function previewDeleteProduct(
  database: DatabaseContext,
  input: { readonly productId: string },
): DatabaseProductDeletePreview {
  requireProduction(database);
  const product = database.sqlite
    .prepare('SELECT id, name, active FROM products WHERE id = ?')
    .get(input.productId) as
    | { readonly id: string; readonly name: string; readonly active: number }
    | undefined;

  if (product === undefined) {
    throw new Error('O produto informado não existe.');
  }

  const activeEventId = getSessionState(database).activeEvent?.id ?? null;
  const stock = database.sqlite
    .prepare('SELECT quantity FROM event_stock WHERE event_id = ? AND product_id = ?')
    .get(activeEventId, product.id) as { readonly quantity: number } | undefined;
  const combos = listActiveDependentCombos(database, product.id);
  const sales = database.sqlite
    .prepare(
      `SELECT COUNT(*) AS value
       FROM order_items
       WHERE item_kind = 'product' AND item_id = ?`,
    )
    .get(product.id) as { readonly value: number };
  const movements = database.sqlite
    .prepare('SELECT COUNT(*) AS value FROM stock_movements WHERE product_id = ?')
    .get(product.id) as { readonly value: number };

  return {
    productId: product.id,
    name: product.name,
    active: product.active === 1,
    activeEventStockQuantity: stock?.quantity ?? 0,
    dependentCombos: combos.map((combo) => combo.name),
    historicalSales: sales.value,
    stockMovements: movements.value,
  };
}

export function deleteProduct(
  database: DatabaseContext,
  input: { readonly productId: string; readonly reason: string },
): DatabaseInventoryProduct {
  const preview = previewDeleteProduct(database, input);

  if (!preview.active) {
    throw new Error('Este produto já está inativo.');
  }

  const reason = requireOperationReason(input.reason);
  const dependentCombos = listActiveDependentCombos(database, preview.productId);
  const activeEventId = getSessionState(database).activeEvent?.id ?? null;
  const correlationId = randomUUID();
  const now = Date.now();

  database.sqlite.transaction(() => {
    for (const combo of dependentCombos) {
      database.sqlite
        .prepare('UPDATE combos SET active = 0, updated_at = ? WHERE id = ? AND active = 1')
        .run(now, combo.id);
      appendAudit(database, {
        action: 'combo.deactivated-by-product-deletion',
        entityType: 'combo',
        entityId: combo.id,
        eventId: activeEventId,
        correlationId,
        details: {
          productId: preview.productId,
          productName: preview.name,
          reason,
        },
        before: { active: true },
        after: { active: false },
        impact: { removedProductId: preview.productId },
      });
    }

    database.sqlite
      .prepare('UPDATE products SET active = 0, updated_at = ? WHERE id = ?')
      .run(now, preview.productId);
    appendAudit(database, {
      action: 'inventory.product-deleted',
      entityType: 'product',
      entityId: preview.productId,
      eventId: activeEventId,
      correlationId,
      details: { impact: preview, reason },
      before: { active: preview.active, stockQuantity: preview.activeEventStockQuantity },
      after: { active: false, stockQuantity: preview.activeEventStockQuantity },
      impact: {
        ...preview,
        deactivatedCombos: dependentCombos.map((combo) => ({ id: combo.id, name: combo.name })),
      },
    });
  })();

  return getProduct(database, preview.productId, activeEventId);
}
