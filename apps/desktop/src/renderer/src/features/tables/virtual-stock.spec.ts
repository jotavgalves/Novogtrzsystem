import { describe, expect, it } from 'vitest';

import type { OperationCatalogItem, Order } from '@gtrz/contracts';

import { projectCatalogForOrder } from './virtual-stock';

const productA = '11111111-1111-4111-8111-111111111111';
const productB = '22222222-2222-4222-8222-222222222222';
const comboId = '33333333-3333-4333-8333-333333333333';

const catalog: readonly OperationCatalogItem[] = [
  {
    id: productA,
    kind: 'product',
    name: 'Coca-Cola',
    salePriceCents: 500,
    availableQuantity: 30,
    active: true,
    components: [{ productId: productA, quantity: 1 }],
  },
  {
    id: productB,
    kind: 'product',
    name: 'Red Bull',
    salePriceCents: 1200,
    availableQuantity: 10,
    active: true,
    components: [{ productId: productB, quantity: 1 }],
  },
  {
    id: comboId,
    kind: 'combo',
    name: 'Combo energético',
    salePriceCents: 2000,
    availableQuantity: 10,
    active: true,
    components: [
      { productId: productA, quantity: 2 },
      { productId: productB, quantity: 1 },
    ],
  },
];

function makeOrder(items: Order['items']): Order {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    eventId: '55555555-5555-4555-8555-555555555555',
    servicePointId: '66666666-6666-4666-8666-666666666666',
    servicePointLabel: 'Mesa 4',
    status: 'open',
    subtotalCents: 0,
    discountCents: 0,
    totalCents: 0,
    paidCents: 0,
    remainingCents: 0,
    items,
    payments: [],
    voucherAllocation: null,
    voucherRedemptions: [],
    openedAt: 1,
    closedAt: null,
    updatedAt: 1,
  };
}

describe('virtual stock per table', () => {
  it('desconta somente o carrinho selecionado e considera componentes de combos', () => {
    const order = makeOrder([
      {
        id: '77777777-7777-4777-8777-777777777777',
        orderId: '44444444-4444-4444-8444-444444444444',
        itemKind: 'product',
        itemId: productA,
        itemName: 'Coca-Cola',
        quantity: 5,
        unitPriceCents: 500,
        totalCents: 2500,
        createdAt: 1,
      },
      {
        id: '88888888-8888-4888-8888-888888888888',
        orderId: '44444444-4444-4444-8444-444444444444',
        itemKind: 'combo',
        itemId: comboId,
        itemName: 'Combo energético',
        quantity: 2,
        unitPriceCents: 2000,
        totalCents: 4000,
        createdAt: 1,
      },
    ]);

    const projected = projectCatalogForOrder(catalog, order);
    expect(projected.find((item) => item.id === productA)?.availableQuantity).toBe(21);
    expect(projected.find((item) => item.id === productB)?.availableQuantity).toBe(8);
    expect(projected.find((item) => item.id === comboId)?.availableQuantity).toBe(8);
  });

  it('não transfere a projeção para outra mesa sem carrinho', () => {
    expect(projectCatalogForOrder(catalog, null)).toEqual(catalog);
  });
});
