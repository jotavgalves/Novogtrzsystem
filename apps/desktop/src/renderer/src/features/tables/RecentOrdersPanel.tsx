import { ChevronDown, ChevronUp, History, Printer, RotateCcw } from 'lucide-react';
import { useState } from 'react';

import type { Order } from '@gtrz/contracts';
import { formatCurrency } from '@gtrz/domain';

import { CancellationForm } from './CancellationForm';

interface RecentOrdersPanelProps {
  readonly orders: readonly Order[];
  readonly busy: boolean;
  readonly allowCancel?: boolean;
  readonly compact?: boolean;
  readonly title?: string;
  readonly description?: string;
  readonly emptyMessage?: string;
  readonly onCancel: (orderId: string, reason: string) => Promise<void>;
  readonly onReprint?: ((orderId: string) => Promise<void>) | undefined;
}

function formatDate(timestamp: number | null): string {
  if (timestamp === null) {
    return 'Sem horário de fechamento';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(timestamp);
}

export function RecentOrdersPanel({
  orders,
  busy,
  allowCancel = true,
  compact = false,
  title = 'Vendas e cancelamentos recentes',
  description = 'Estornos devolvem exatamente as unidades registradas na venda original.',
  emptyMessage = 'Nenhuma venda concluída neste evento.',
  onCancel,
  onReprint,
}: RecentOrdersPanelProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const visibleOrders = compact && !expanded ? orders.slice(0, 3) : orders;
  const hiddenCount = Math.max(orders.length - visibleOrders.length, 0);

  return (
    <article className={compact ? 'panel recent-orders-panel recent-orders-panel--compact' : 'panel recent-orders-panel'}>
      <div className="panel__heading recent-orders-panel__heading">
        <History size={20} aria-hidden="true" />
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {compact && orders.length > 3 ? (
          <button
            className="button button--ghost button--compact"
            onClick={() => {
              setExpanded((current) => !current);
            }}
            type="button"
          >
            {expanded ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
            {expanded ? 'Recolher' : `Ver mais (${String(hiddenCount)})`}
          </button>
        ) : null}
      </div>

      {orders.length === 0 ? (
        <p className="operation-empty">{emptyMessage}</p>
      ) : (
        <div className={compact ? 'recent-order-list recent-order-list--compact' : 'recent-order-list'}>
          {visibleOrders.map((order) => (
            <article className={compact ? 'recent-order-card recent-order-card--compact' : 'recent-order-card'} key={order.id}>
              <div className="recent-order-card__summary">
                <span>
                  <strong>{order.servicePointLabel}</strong>
                  <small>{formatDate(order.closedAt)}</small>
                </span>
                <span
                  className={
                    order.status === 'cancelled'
                      ? 'status-badge status-badge--archived'
                      : 'status-badge status-badge--open'
                  }
                >
                  {order.status === 'cancelled' ? 'Cancelada' : 'Paga'}
                </span>
                <strong>{formatCurrency(order.totalCents)}</strong>
              </div>

              <p className="recent-order-card__items">
                {order.items
                  .map((item) => `${String(item.quantity)}× ${item.itemName}`)
                  .join(' · ')}
              </p>

              {order.status === 'paid' && onReprint !== undefined ? (
                <button
                  className="button button--ghost button--compact recent-order-card__print"
                  disabled={busy}
                  onClick={() => {
                    void onReprint(order.id);
                  }}
                  type="button"
                >
                  <Printer size={14} aria-hidden="true" />
                  Reimprimir
                </button>
              ) : null}

              {allowCancel && order.status === 'paid' ? (
                <details className="recent-order-card__cancel-details" open={!compact}>
                  <summary>
                    <RotateCcw size={14} aria-hidden="true" /> Estornar venda
                  </summary>
                  <div className="recent-order-card__cancel">
                    <CancellationForm
                      busy={busy}
                      label="Confirmar estorno"
                      onSubmit={(reason) => onCancel(order.id, reason)}
                    />
                  </div>
                </details>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </article>
  );
}
