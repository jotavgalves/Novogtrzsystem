import { ArrowLeft, ChevronDown, History, ReceiptText } from 'lucide-react';
import { useState } from 'react';

import type { CloseOrderInput, Order, ServicePoint } from '@gtrz/contracts';
import { formatCurrency } from '@gtrz/domain';

import { CancellationForm } from './CancellationForm';
import { CheckoutForm } from './CheckoutForm';
import { OrderItemQuantity } from './OrderItemQuantity';
import { RecentOrdersPanel } from './RecentOrdersPanel';

interface OrderPanelProps {
  readonly servicePoint: ServicePoint;
  readonly order: Order | null;
  readonly history: readonly Order[];
  readonly busy: boolean;
  readonly production: boolean;
  readonly onBack: () => void;
  readonly onSetItemQuantity: (orderItemId: string, quantity: number) => Promise<void>;
  readonly onRemoveItem: (orderItemId: string) => Promise<void>;
  readonly onBindVoucher: (code: string) => Promise<void>;
  readonly onUnbindVoucher: () => Promise<void>;
  readonly onCloseOrder: (input: Omit<CloseOrderInput, 'orderId'>) => Promise<void>;
  readonly onCancelOrder: (reason: string) => Promise<void>;
  readonly onCancelHistoricalOrder: (orderId: string, reason: string) => Promise<void>;
  readonly onReprintOrder?: ((orderId: string) => Promise<void>) | undefined;
}

export function OrderPanel({
  servicePoint,
  order,
  history,
  busy,
  production,
  onBack,
  onSetItemQuantity,
  onRemoveItem,
  onBindVoucher,
  onUnbindVoucher,
  onCloseOrder,
  onCancelOrder,
  onCancelHistoricalOrder,
  onReprintOrder,
}: OrderPanelProps): React.JSX.Element {
  const [historyOpen, setHistoryOpen] = useState(false);
  const hasItems = order !== null && order.items.length > 0;

  return (
    <div className="order-workspace-stack">
      <article className="panel order-panel">
        <div className="order-panel__header">
          <button
            aria-label="Voltar para mesas"
            className="icon-button order-panel__back"
            disabled={busy}
            onClick={onBack}
            title="Voltar para mesas"
            type="button"
          >
            <ArrowLeft size={17} aria-hidden="true" />
          </button>
          <div className="panel__heading">
            <ReceiptText size={20} aria-hidden="true" />
            <div>
              <h2>{servicePoint.label}</h2>
              <p>
                {order === null
                  ? 'Mesa livre · adicione um produto para iniciar uma nova venda.'
                  : 'Comanda aberta · ajuste as quantidades diretamente no carrinho.'}
              </p>
            </div>
          </div>
        </div>

        <div className="order-items order-items--cart">
          {!hasItems ? (
            <p className="operation-empty">Adicione produtos ou combos pelo catálogo.</p>
          ) : null}
          {order?.items.map((item) => (
            <div className="order-item" key={item.id}>
              <span>
                <strong>{item.itemName}</strong>
                <small>{formatCurrency(item.unitPriceCents)} por unidade</small>
              </span>
              <OrderItemQuantity
                busy={busy}
                item={item}
                onChange={onSetItemQuantity}
                onRemove={onRemoveItem}
              />
              <strong>{formatCurrency(item.totalCents)}</strong>
            </div>
          ))}
        </div>

        <div className="order-summary">
          <span>Subtotal</span>
          <strong>{formatCurrency(order?.subtotalCents ?? 0)}</strong>
        </div>

        {order !== null && order.items.length > 0 ? (
          <CheckoutForm
            busy={busy}
            onBindVoucher={onBindVoucher}
            onClose={onCloseOrder}
            onUnbindVoucher={onUnbindVoucher}
            order={order}
          />
        ) : null}

        {production && order !== null ? (
          <div className="order-cancellation">
            <CancellationForm busy={busy} label="Cancelar comanda" onSubmit={onCancelOrder} />
          </div>
        ) : null}
      </article>

      <section className={historyOpen ? 'order-history-drawer order-history-drawer--open' : 'order-history-drawer'}>
        <button
          aria-expanded={historyOpen}
          className="order-history-drawer__trigger"
          onClick={() => {
            setHistoryOpen((current) => !current);
          }}
          type="button"
        >
          <span>
            <History size={18} aria-hidden="true" />
            <strong>Histórico da mesa</strong>
            <small>{history.length} venda(s) registrada(s)</small>
          </span>
          <ChevronDown size={18} aria-hidden="true" />
        </button>

        {historyOpen ? (
          <div className="order-history-drawer__content">
            <RecentOrdersPanel
              allowCancel={production}
              busy={busy}
              compact
              description="As vendas permanecem ligadas a esta mesa mesmo depois do pagamento."
              emptyMessage="Esta mesa ainda não possui vendas concluídas."
              onCancel={onCancelHistoricalOrder}
              onReprint={onReprintOrder}
              orders={history}
              title="Histórico da mesa"
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
