// Tipos canônicos compartilhados pelas regras de cadastro e movimentação de estoque.
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
