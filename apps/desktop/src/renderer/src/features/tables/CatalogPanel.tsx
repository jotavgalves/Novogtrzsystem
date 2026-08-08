import { PackageSearch, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { OperationCatalogItem, OrderItemKind } from '@gtrz/contracts';
import { formatCurrency } from '@gtrz/domain';

interface CatalogPanelProps {
  readonly items: readonly OperationCatalogItem[];
  readonly onAdd: (item: OperationCatalogItem) => Promise<void>;
}

export function CatalogPanel({ items, onAdd }: CatalogPanelProps): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<OrderItemKind | 'all'>('all');
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('pt-BR');
    return items.filter(
      (item) =>
        (kind === 'all' || item.kind === kind) &&
        (normalized.length === 0 || item.name.toLocaleLowerCase('pt-BR').includes(normalized)),
    );
  }, [items, kind, search]);

  return (
    <article className="panel operation-catalog">
      <div className="panel__heading">
        <PackageSearch size={20} aria-hidden="true" />
        <div>
          <h2>Produtos e combos</h2>
          <p>O saldo exibido já desconta virtualmente o carrinho desta mesa.</p>
        </div>
      </div>

      <div className="operation-catalog__filters">
        <label className="compact-field__input">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Buscar produto ou combo"
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Buscar item"
            value={search}
          />
        </label>
        <select
          aria-label="Filtrar catálogo"
          onChange={(event) => {
            setKind(event.target.value as OrderItemKind | 'all');
          }}
          value={kind}
        >
          <option value="all">Todos</option>
          <option value="product">Produtos</option>
          <option value="combo">Combos</option>
        </select>
      </div>

      <div className="operation-catalog__list">
        {filtered.map((item) => {
          const available = item.active && item.availableQuantity > 0;
          const key = `${item.kind}-${item.id}`;
          const pending = pendingKey === key;
          return (
            <button
              aria-busy={pending}
              className={pending ? 'catalog-item catalog-item--pending' : 'catalog-item'}
              disabled={!available}
              key={key}
              onClick={() => {
                if (pendingKey !== null) {
                  return;
                }

                setPendingKey(key);
                void onAdd(item).finally(() => {
                  setPendingKey(null);
                });
              }}
              type="button"
            >
              <span>
                <strong>{item.name}</strong>
                <small>
                  {item.kind === 'combo' ? 'Combo' : 'Produto'} · {item.availableQuantity}{' '}
                  disponíveis nesta mesa
                </small>
              </span>
              <span className="catalog-item__price">{formatCurrency(item.salePriceCents)}</span>
              <Plus size={17} aria-hidden="true" />
            </button>
          );
        })}
        {filtered.length === 0 ? <p className="operation-empty">Nenhum item encontrado.</p> : null}
      </div>
    </article>
  );
}
