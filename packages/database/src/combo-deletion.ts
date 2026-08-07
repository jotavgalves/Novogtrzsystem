import { appendAudit } from './audit';
import { getSessionState } from './control';
import { requireCombo, type DatabaseInventoryCombo } from './combos';
import type { DatabaseContext } from './types';

export interface DatabaseComboDeletePreview {
  readonly comboId: string;
  readonly name: string;
  readonly active: boolean;
  readonly components: readonly {
    readonly productId: string;
    readonly productName: string;
    readonly quantity: number;
  }[];
  readonly historicalSales: number;
}

function requireProduction(database: DatabaseContext): void {
  if (getSessionState(database).profile !== 'production') {
    throw new Error('A exclusão de combos exige o perfil Produção.');
  }
}

export function previewDeleteCombo(
  database: DatabaseContext,
  input: { readonly comboId: string },
): DatabaseComboDeletePreview {
  requireProduction(database);
  const combo = requireCombo(database, input.comboId);
  const sales = database.sqlite
    .prepare(
      `SELECT COUNT(*) AS value
       FROM order_items
       WHERE item_kind = 'combo' AND item_id = ?`,
    )
    .get(combo.id) as { readonly value: number };

  return {
    comboId: combo.id,
    name: combo.name,
    active: combo.active,
    components: combo.components.map((component) => ({
      productId: component.productId,
      productName: component.productName,
      quantity: component.quantity,
    })),
    historicalSales: sales.value,
  };
}

export function deleteCombo(
  database: DatabaseContext,
  input: { readonly comboId: string; readonly reason: string },
): DatabaseInventoryCombo {
  const preview = previewDeleteCombo(database, input);
  const reason = input.reason.trim();
  const now = Date.now();

  database.sqlite.transaction(() => {
    database.sqlite
      .prepare('UPDATE combos SET active = 0, updated_at = ? WHERE id = ?')
      .run(now, preview.comboId);
    appendAudit(database, {
      action: 'combo.deleted',
      entityType: 'combo',
      entityId: preview.comboId,
      eventId: getSessionState(database).activeEvent?.id ?? null,
      details: { impact: preview, reason },
      before: { active: preview.active, components: preview.components },
      after: { active: false, components: preview.components },
      impact: preview,
    });
  })();

  return requireCombo(database, preview.comboId);
}
