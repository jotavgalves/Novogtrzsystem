import { appendAudit } from './audit';
import { getSessionState } from './control';
import { getProduct, type DatabaseInventoryProduct } from './inventory';
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

function requireProduction(database: DatabaseContext): void {
  if (getSessionState(database).profile !== 'production') {
    throw new Error('A exclusão de produtos exige o perfil Produção.');
  }
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
  const combos = database.sqlite
    .prepare(
      `SELECT c.name
       FROM combo_components cc
       INNER JOIN combos c ON c.id = cc.combo_id
       WHERE cc.product_id = ? AND c.active = 1
       ORDER BY c.name COLLATE NOCASE`,
    )
    .all(product.id) as { readonly name: string }[];
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
  const reason = input.reason.trim();
  const now = Date.now();

  database.sqlite.transaction(() => {
    database.sqlite
      .prepare('UPDATE products SET active = 0, updated_at = ? WHERE id = ?')
      .run(now, preview.productId);
    appendAudit(database, {
      action: 'inventory.product-deleted',
      entityType: 'product',
      entityId: preview.productId,
      eventId: getSessionState(database).activeEvent?.id ?? null,
      details: { impact: preview, reason },
      before: { active: preview.active, stockQuantity: preview.activeEventStockQuantity },
      after: { active: false, stockQuantity: preview.activeEventStockQuantity },
      impact: preview,
    });
  })();

  return getProduct(database, preview.productId, getSessionState(database).activeEvent?.id ?? null);
}
