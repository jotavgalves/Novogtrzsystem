import { randomUUID } from 'node:crypto';

import { appendAudit } from './audit';
import { getSessionState } from './control';
import type { DatabaseContext } from './types';

export interface DatabaseComboComponentInput {
  readonly productId: string;
  readonly quantity: number;
}

interface ComboWriteInput {
  readonly name: string;
  readonly salePriceCents: number;
  readonly components: readonly DatabaseComboComponentInput[];
}

export interface DatabaseComboComponent {
  readonly productId: string;
  readonly productName: string;
  readonly quantity: number;
  readonly salePriceCents: number;
  readonly availableQuantity: number;
}

export interface DatabaseComboFinancials {
  readonly costCents: number;
  readonly grossProfitCents: number;
  readonly marginPercent: number;
}

export interface DatabaseInventoryCombo {
  readonly id: string;
  readonly name: string;
  readonly salePriceCents: number;
  readonly individualSaleTotalCents: number;
  readonly savingsCents: number;
  readonly availableUnits: number;
  readonly active: boolean;
  readonly components: readonly DatabaseComboComponent[];
  readonly financials: DatabaseComboFinancials | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

interface ComboRow {
  readonly id: string;
  readonly name: string;
  readonly sale_price_cents: number;
  readonly active: number;
  readonly created_at: number;
  readonly updated_at: number;
}

interface ComponentRow {
  readonly combo_id: string;
  readonly product_id: string;
  readonly product_name: string;
  readonly required_quantity: number;
  readonly sale_price_cents: number;
  readonly cost_cents: number;
  readonly product_active: number;
  readonly available_quantity: number;
}

interface ProductValidationRow {
  readonly id: string;
  readonly name: string;
  readonly active: number;
}

function requireProduction(database: DatabaseContext): void {
  if (getSessionState(database).profile !== 'production') {
    throw new Error('Esta operação de combo exige o perfil Produção.');
  }
}

function requireUniqueName(database: DatabaseContext, name: string, excludedId?: string): void {
  const duplicate = database.sqlite
    .prepare(
      `SELECT id
       FROM combos
       WHERE name = ? COLLATE NOCASE
         AND (? IS NULL OR id != ?)`,
    )
    .get(name, excludedId ?? null, excludedId ?? null) as { readonly id: string } | undefined;

  if (duplicate !== undefined) {
    throw new Error('Já existe um combo com esse nome.');
  }
}

function validateComponents(
  database: DatabaseContext,
  components: readonly DatabaseComboComponentInput[],
): void {
  if (components.length === 0) {
    throw new Error('O combo precisa de pelo menos um produto.');
  }

  const uniqueIds = new Set<string>();

  for (const component of components) {
    if (!Number.isInteger(component.quantity) || component.quantity <= 0) {
      throw new Error('As quantidades dos componentes devem ser inteiras e positivas.');
    }

    if (uniqueIds.has(component.productId)) {
      throw new Error('Um produto não pode aparecer duas vezes no mesmo combo.');
    }

    uniqueIds.add(component.productId);
    const product = database.sqlite
      .prepare('SELECT id, name, active FROM products WHERE id = ?')
      .get(component.productId) as ProductValidationRow | undefined;

    if (product === undefined) {
      throw new Error('Um dos produtos informados não existe.');
    }

    if (product.active !== 1) {
      throw new Error(`O produto ${product.name} está inativo e não pode compor o combo.`);
    }
  }
}

function calculateMarginPercent(salePriceCents: number, costCents: number): number {
  if (salePriceCents === 0) {
    return 0;
  }

  return Math.round(((salePriceCents - costCents) / salePriceCents) * 10_000) / 100;
}

function listComponentRows(
  database: DatabaseContext,
  activeEventId: string | null,
): readonly ComponentRow[] {
  return database.sqlite
    .prepare(
      `SELECT
         cc.combo_id,
         p.id AS product_id,
         p.name AS product_name,
         cc.quantity AS required_quantity,
         p.sale_price_cents,
         p.cost_cents,
         p.active AS product_active,
         COALESCE(es.quantity, 0) AS available_quantity
       FROM combo_components cc
       INNER JOIN products p ON p.id = cc.product_id
       LEFT JOIN event_stock es
         ON es.product_id = p.id
        AND es.event_id = ?
       ORDER BY cc.combo_id, p.name COLLATE NOCASE`,
    )
    .all(activeEventId) as ComponentRow[];
}

function mapCombo(
  row: ComboRow,
  componentRows: readonly ComponentRow[],
  activeEventId: string | null,
  showFinancials: boolean,
): DatabaseInventoryCombo {
  const components = componentRows.map((component) => ({
    productId: component.product_id,
    productName: component.product_name,
    quantity: component.required_quantity,
    salePriceCents: component.sale_price_cents,
    availableQuantity: component.available_quantity,
  }));
  const individualSaleTotalCents = componentRows.reduce(
    (total, component) => total + component.sale_price_cents * component.required_quantity,
    0,
  );
  const costCents = componentRows.reduce(
    (total, component) => total + component.cost_cents * component.required_quantity,
    0,
  );
  const hasUnavailableComponent = componentRows.some((component) => component.product_active !== 1);
  const availableUnits =
    activeEventId === null || componentRows.length === 0 || hasUnavailableComponent
      ? 0
      : Math.min(
          ...componentRows.map((component) =>
            Math.floor(component.available_quantity / component.required_quantity),
          ),
        );
  const grossProfitCents = row.sale_price_cents - costCents;

  return {
    id: row.id,
    name: row.name,
    salePriceCents: row.sale_price_cents,
    individualSaleTotalCents,
    savingsCents: individualSaleTotalCents - row.sale_price_cents,
    availableUnits,
    active: row.active === 1,
    components,
    financials: showFinancials
      ? {
          costCents,
          grossProfitCents,
          marginPercent: calculateMarginPercent(row.sale_price_cents, costCents),
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listCombos(database: DatabaseContext): readonly DatabaseInventoryCombo[] {
  const session = getSessionState(database);
  const activeEventId = session.activeEvent?.id ?? null;
  const showFinancials = session.profile === 'production';
  const comboRows = database.sqlite
    .prepare(
      `SELECT id, name, sale_price_cents, active, created_at, updated_at
       FROM combos
       ORDER BY active DESC, name COLLATE NOCASE`,
    )
    .all() as ComboRow[];
  const componentRows = listComponentRows(database, activeEventId);
  const componentsByCombo = new Map<string, ComponentRow[]>();

  for (const component of componentRows) {
    const grouped = componentsByCombo.get(component.combo_id) ?? [];
    grouped.push(component);
    componentsByCombo.set(component.combo_id, grouped);
  }

  return comboRows.map((combo) =>
    mapCombo(combo, componentsByCombo.get(combo.id) ?? [], activeEventId, showFinancials),
  );
}

export function requireCombo(database: DatabaseContext, comboId: string): DatabaseInventoryCombo {
  const combo = listCombos(database).find((item) => item.id === comboId);

  if (combo === undefined) {
    throw new Error('O combo informado não existe.');
  }

  return combo;
}

function insertComponents(
  database: DatabaseContext,
  comboId: string,
  components: readonly DatabaseComboComponentInput[],
): void {
  const insert = database.sqlite.prepare(
    `INSERT INTO combo_components (combo_id, product_id, quantity)
     VALUES (?, ?, ?)`,
  );

  for (const component of components) {
    insert.run(comboId, component.productId, component.quantity);
  }
}

export function createCombo(
  database: DatabaseContext,
  input: ComboWriteInput,
): DatabaseInventoryCombo {
  requireProduction(database);
  const name = input.name.trim();
  requireUniqueName(database, name);
  validateComponents(database, input.components);

  if (!Number.isInteger(input.salePriceCents) || input.salePriceCents < 0) {
    throw new Error('O preço do combo deve ser informado em centavos inteiros não negativos.');
  }

  const comboId = randomUUID();
  const now = Date.now();

  database.sqlite.transaction(() => {
    database.sqlite
      .prepare(
        `INSERT INTO combos
         (id, name, sale_price_cents, active, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)`,
      )
      .run(comboId, name, input.salePriceCents, now, now);
    insertComponents(database, comboId, input.components);
    appendAudit(database, {
      action: 'combo.created',
      entityType: 'combo',
      entityId: comboId,
      details: {
        components: input.components,
        name,
        salePriceCents: input.salePriceCents,
      },
    });
  })();

  return requireCombo(database, comboId);
}

export function updateCombo(
  database: DatabaseContext,
  input: ComboWriteInput & { readonly comboId: string; readonly active: boolean },
): DatabaseInventoryCombo {
  requireProduction(database);
  const before = requireCombo(database, input.comboId);
  const name = input.name.trim();
  requireUniqueName(database, name, input.comboId);
  validateComponents(database, input.components);

  if (!Number.isInteger(input.salePriceCents) || input.salePriceCents < 0) {
    throw new Error('O preço do combo deve ser informado em centavos inteiros não negativos.');
  }

  const now = Date.now();

  database.sqlite.transaction(() => {
    database.sqlite
      .prepare(
        `UPDATE combos
         SET name = ?, sale_price_cents = ?, active = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(name, input.salePriceCents, input.active ? 1 : 0, now, input.comboId);
    database.sqlite.prepare('DELETE FROM combo_components WHERE combo_id = ?').run(input.comboId);
    insertComponents(database, input.comboId, input.components);
    appendAudit(database, {
      action: 'combo.updated',
      entityType: 'combo',
      entityId: input.comboId,
      details: {
        after: {
          active: input.active,
          components: input.components,
          name,
          salePriceCents: input.salePriceCents,
        },
        before,
      },
    });
  })();

  return requireCombo(database, input.comboId);
}
