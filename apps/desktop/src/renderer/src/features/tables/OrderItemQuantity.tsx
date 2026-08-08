import { Minus, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { OrderItem } from '@gtrz/contracts';

interface OrderItemQuantityProps {
  readonly item: OrderItem;
  readonly busy: boolean;
  readonly onChange: (orderItemId: string, quantity: number) => Promise<void>;
  readonly onRemove: (orderItemId: string) => Promise<void>;
}

export function OrderItemQuantity({
  item,
  busy,
  onChange,
  onRemove,
}: OrderItemQuantityProps): React.JSX.Element {
  const [value, setValue] = useState(String(item.quantity));

  useEffect(() => {
    setValue(String(item.quantity));
  }, [item.quantity]);

  const commit = (): void => {
    const quantity = Number.parseInt(value, 10);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setValue(String(item.quantity));
      return;
    }

    if (quantity !== item.quantity) {
      void onChange(item.id, quantity);
    }
  };

  return (
    <div className="order-item__quantity" aria-label={`Quantidade de ${item.itemName}`}>
      <button
        aria-label={`Diminuir ${item.itemName}`}
        className="quantity-button"
        disabled={busy}
        onClick={() => {
          if (item.quantity === 1) {
            void onRemove(item.id);
          } else {
            void onChange(item.id, item.quantity - 1);
          }
        }}
        type="button"
      >
        <Minus size={14} aria-hidden="true" />
      </button>
      <input
        aria-label={`Quantidade de ${item.itemName}`}
        disabled={busy}
        inputMode="numeric"
        min={1}
        onBlur={commit}
        onChange={(event) => {
          setValue(event.target.value.replaceAll(/[^0-9]/gu, ''));
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        type="number"
        value={value}
      />
      <button
        aria-label={`Aumentar ${item.itemName}`}
        className="quantity-button"
        disabled={busy}
        onClick={() => {
          void onChange(item.id, item.quantity + 1);
        }}
        type="button"
      >
        <Plus size={14} aria-hidden="true" />
      </button>
      <button
        aria-label={`Remover ${item.itemName}`}
        className="quantity-button quantity-button--remove"
        disabled={busy}
        onClick={() => {
          void onRemove(item.id);
        }}
        title="Remover item"
        type="button"
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
