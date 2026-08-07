import { ArrowLeft, ReceiptText, Trash2 } from 'lucide-react';

import type { CloseOrderInput, Order } from '@gtrz/contracts';

import { CancellationForm } from './CancellationForm';
import { CheckoutForm } from './CheckoutForm';

interface OrderPanelProps {
  readonly order: Order;
  readonly busy: boolean;
  readonly production: boolean;
  readonly onBack: () => void;
  readonly onRemoveItem: (orderItemId: string) => Promise<void>;
  readonly onBindVoucher: (code: string) => Promise<void>;
  readonly onUnbindVoucher: () => Promise<void>;
  readonly onCloseOrder: (input: Omit<CloseOrderInput, 'orderId'>) => Promise<void>;
  readonly onCancelOrder: (reason: string) => Promise<void>;
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function OrderPanel({
  order,
  busy,
  production,
  onBack,
  onRemoveItem,
  onBindVoucher,
  onUnbindVoucher,
  onCloseOrder,
  onCancelOrder,
}: OrderPanelProps): React.JSX.Element {
  return (
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
            <h2>{order.servicePointLabel}</h2>
            <p>Comanda aberta · os preços ficam congelados ao adicionar cada item.</p>
          </div>
        </div>
      </div>

      <div className="order-items">
        {order.items.length === 0 ? (
          <p className="operation-empty">Adicione produtos ou combos pelo catálogo.</p>
        ) : null}
        {order.items.map((item) => (
          <div className="order-item" key={item.id}>
            <span>
              <strong>{item.itemName}</strong>
              <small>
                {item.quantity} × {formatMoney(item.unitPriceCents)}
              </small>
            </span>
            <strong>{formatMoney(item.totalCents)}</strong>
            <button
              aria-label={`Remover ${item.itemName}`}
              className="icon-button"
              disabled={busy}
              onClick={() => {
                void onRemoveItem(item.id);
              }}
              type="button"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <div className="order-summary">
        <span>Subtotal</span>
        <strong>{formatMoney(order.subtotalCents)}</strong>
      </div>

      <CheckoutForm
        busy={busy}
        onBindVoucher={onBindVoucher}
        onClose={onCloseOrder}
        onUnbindVoucher={onUnbindVoucher}
        order={order}
      />

      {production ? (
        <div className="order-cancellation">
          <CancellationForm busy={busy} label="Cancelar comanda" onSubmit={onCancelOrder} />
        </div>
      ) : null}
    </article>
  );
}
