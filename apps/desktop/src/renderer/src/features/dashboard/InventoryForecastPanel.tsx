import { BarChart3, Boxes, CircleDollarSign } from 'lucide-react';

import type { DashboardState, InventoryBreakEvenItem } from '@gtrz/contracts';
import { formatCurrency } from '@gtrz/domain';

interface InventoryForecastPanelProps {
  readonly state: DashboardState;
}

function groupByCategory(
  items: readonly InventoryBreakEvenItem[],
): readonly [string, readonly InventoryBreakEvenItem[]][] {
  const groups = new Map<string, InventoryBreakEvenItem[]>();

  for (const item of items) {
    const current = groups.get(item.categoryName) ?? [];
    current.push(item);
    groups.set(item.categoryName, current);
  }

  return [...groups.entries()];
}

function getProgress(item: InventoryBreakEvenItem): number {
  if (item.breakEvenUnits === null || item.breakEvenUnits === 0) {
    return item.breakEvenUnits === 0 ? 100 : 0;
  }

  return Math.min(Math.round((item.soldUnits / item.breakEvenUnits) * 100), 100);
}

function BreakEvenRow({ item }: { readonly item: InventoryBreakEvenItem }): React.JSX.Element {
  const progress = getProgress(item);
  const paid = item.remainingUnitsToBreakEven === 0 && item.breakEvenUnits !== null;

  return (
    <div className="inventory-break-even-row">
      <div className="inventory-break-even-row__identity">
        <strong>{item.productName}</strong>
        <small>
          {item.purchasedUnits} compradas · {item.soldUnits} vendidas líquidas ·{' '}
          {item.currentStockUnits} em estoque
        </small>
      </div>
      <div className="inventory-break-even-row__numbers">
        <span>
          <small>Custo comprado</small>
          <strong>{formatCurrency(item.purchaseCostCents)}</strong>
        </span>
        <span>
          <small>Preço de venda</small>
          <strong>{formatCurrency(item.salePriceCents)}</strong>
        </span>
        <span>
          <small>Para se pagar</small>
          <strong>
            {item.breakEvenUnits === null ? 'Sem preço' : `${String(item.breakEvenUnits)} un.`}
          </strong>
        </span>
        <span>
          <small>Faltam</small>
          <strong>
            {item.remainingUnitsToBreakEven === null
              ? '—'
              : `${String(item.remainingUnitsToBreakEven)} un.`}
          </strong>
        </span>
      </div>
      <div className="inventory-break-even-row__progress" aria-label={`Progresso ${item.productName}`}>
        <span style={{ width: `${String(progress)}%` }} />
      </div>
      <small className={paid ? 'inventory-break-even-row__status is-paid' : 'inventory-break-even-row__status'}>
        {item.breakEvenUnits === null
          ? 'Cadastre um preço de venda para calcular o ponto de equilíbrio.'
          : paid
            ? 'O custo das compras deste item já foi coberto pelas vendas.'
            : `${String(progress)}% do ponto de equilíbrio atingido.`}
      </small>
    </div>
  );
}

export function InventoryForecastPanel({ state }: InventoryForecastPanelProps): React.JSX.Element {
  const categories = groupByCategory(state.inventoryBreakEven);

  return (
    <section className="inventory-forecast-stack">
      <article className="panel inventory-value-panel">
        <div className="panel__heading">
          <CircleDollarSign size={20} aria-hidden="true" />
          <div>
            <h2>Valor previsto do estoque</h2>
            <p>Projeção caso todo o estoque atual seja vendido pelos preços cadastrados.</p>
          </div>
        </div>
        <div className="inventory-value-panel__grid">
          <span>
            <small>Unidades disponíveis</small>
            <strong>{state.inventory.units}</strong>
          </span>
          <span>
            <small>Custo atual do estoque</small>
            <strong>{formatCurrency(state.inventory.stockCostCents)}</strong>
          </span>
          <span className="is-highlighted">
            <small>Venda potencial</small>
            <strong>{formatCurrency(state.inventory.potentialRevenueCents)}</strong>
          </span>
          <span>
            <small>Margem bruta potencial</small>
            <strong>{formatCurrency(state.inventory.potentialGrossProfitCents)}</strong>
          </span>
        </div>
      </article>

      <article className="panel inventory-break-even-panel">
        <div className="panel__heading">
          <BarChart3 size={20} aria-hidden="true" />
          <div>
            <h2>Quanto precisa vender para cada item se pagar</h2>
            <p>
              O cálculo usa o custo acumulado das compras do item no evento e o preço de venda
              cadastrado. Estornos reduzem as unidades vendidas líquidas.
            </p>
          </div>
        </div>

        {categories.length === 0 ? (
          <div className="operation-empty">
            <Boxes size={18} aria-hidden="true" /> Nenhuma compra de estoque registrada neste evento.
          </div>
        ) : (
          <div className="inventory-break-even-categories">
            {categories.map(([categoryName, items]) => (
              <section className="inventory-break-even-category" key={categoryName}>
                <h3>{categoryName}</h3>
                <div className="inventory-break-even-list">
                  {items.map((item) => (
                    <BreakEvenRow item={item} key={item.productId} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
