import type { OperationCatalogItem, Order } from '@gtrz/contracts';

function addConsumption(target: Map<string, number>, productId: string, quantity: number): void {
  target.set(productId, (target.get(productId) ?? 0) + quantity);
}

export function projectCatalogForOrder(
  catalog: readonly OperationCatalogItem[],
  order: Order | null,
): readonly OperationCatalogItem[] {
  if (order === null || order.items.length === 0) {
    return catalog;
  }

  const physicalStock = new Map<string, number>();
  for (const item of catalog) {
    if (item.kind === 'product') {
      physicalStock.set(item.id, item.availableQuantity);
    }
  }

  const consumed = new Map<string, number>();
  for (const orderItem of order.items) {
    const catalogItem = catalog.find(
      (item) => item.id === orderItem.itemId && item.kind === orderItem.itemKind,
    );

    if (catalogItem === undefined) {
      continue;
    }

    for (const component of catalogItem.components) {
      addConsumption(consumed, component.productId, component.quantity * orderItem.quantity);
    }
  }

  const remainingByProduct = new Map<string, number>();
  for (const [productId, quantity] of physicalStock) {
    remainingByProduct.set(productId, Math.max(quantity - (consumed.get(productId) ?? 0), 0));
  }

  return catalog.map((item) => {
    const virtualAvailable =
      item.kind === 'product'
        ? (remainingByProduct.get(item.id) ?? 0)
        : item.components.length === 0
          ? 0
          : Math.min(
              ...item.components.map((component) =>
                Math.floor((remainingByProduct.get(component.productId) ?? 0) / component.quantity),
              ),
            );

    return {
      ...item,
      availableQuantity: Math.max(virtualAvailable, 0),
    };
  });
}
