import { describe, expect, it } from 'vitest';

import {
  createCategoryInputSchema,
  createProductInputSchema,
  inventoryProductSchema,
  recordStockMovementInputSchema,
} from './inventory';

describe('inventory contracts', () => {
  it('normaliza categoria e produto antes de atravessar o IPC', () => {
    expect(createCategoryInputSchema.parse({ name: '  Cervejas  ' })).toEqual({
      name: 'Cervejas',
    });
    expect(
      createProductInputSchema.parse({
        categoryId: '85ffbb3f-6d4c-43d3-b615-e437fd5d88f4',
        name: '  Budweiser lata  ',
        kind: 'drink',
        costCents: 600,
        salePriceCents: 1_000,
        lowStockThreshold: 3,
      }),
    ).toMatchObject({ name: 'Budweiser lata', costCents: 600, salePriceCents: 1_000 });
  });

  it('rejeita quantidades inválidas e valores monetários negativos', () => {
    expect(() =>
      recordStockMovementInputSchema.parse({
        productId: '85ffbb3f-6d4c-43d3-b615-e437fd5d88f4',
        type: 'loss',
        quantity: 0,
      }),
    ).toThrow();
    expect(() =>
      createProductInputSchema.parse({
        categoryId: '85ffbb3f-6d4c-43d3-b615-e437fd5d88f4',
        name: 'Produto inválido',
        kind: 'food',
        costCents: -1,
        salePriceCents: 1_000,
        lowStockThreshold: 0,
      }),
    ).toThrow();
  });

  it('aceita visão de Caixa sem informações financeiras', () => {
    expect(
      inventoryProductSchema.parse({
        id: '85ffbb3f-6d4c-43d3-b615-e437fd5d88f4',
        categoryId: '725a7e97-e95f-4557-a020-d485eba6b3a1',
        categoryName: 'Cervejas',
        name: 'Budweiser lata',
        kind: 'drink',
        salePriceCents: 1_000,
        lowStockThreshold: 3,
        active: true,
        quantity: 7,
        lowStock: false,
        financials: null,
        createdAt: 1_786_000_000_000,
        updatedAt: 1_786_000_000_000,
      }),
    ).toMatchObject({ financials: null, quantity: 7 });
  });
});
