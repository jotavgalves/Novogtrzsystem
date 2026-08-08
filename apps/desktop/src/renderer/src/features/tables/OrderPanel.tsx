import { ArrowLeft, ReceiptText } from 'lucide-react';

import type { CloseOrderInput, Order, ServicePoint } from '@gtrz/contracts';

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
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
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
}: OrderPanelProps): React.JSX.Element {
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

        <div className="order-items">
          {!hasItems ? (
            <p className="operation-empty">Adicione produtos ou combos pelo catálogo.</p>
          ) : null}
          {order?.items.map((item) => (
            <div className="order-item" key={item.id}>
              <span>
                <strong>{item.itemName}</strong>
                <small>{formatMoney(item.unitPriceCents)} por unidade</small>
              </span>
              <OrderItemQuantity
                busy={busy}
                item={item}
                onChange={onSetItemQuantity}
                onRemove={onRemoveItem}
              />
              <strong>{formatMoney(item.totalCents)}</strong>
            </div>
          ))}
        </div>

        <div className="order-summary">
          <span>Subtotal</span>
          <strong>{formatMoney(order?.subtotalCents ?? 0)}</strong>
        </div>

        {hasItems && order !== null ? (
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

      <RecentOrdersPanel
        allowCancel={production}
        busy={busy}
        description="As vendas permanecem ligadas a esta mesa mesmo depois do pagamento."
        emptyMessage="Esta mesa ainda não possui vendas concluídas."
        onCancel={onCancelHistoricalOrder}
        orders={history}
        title="Histórico da mesa"
      />
    </div>
  );
}
