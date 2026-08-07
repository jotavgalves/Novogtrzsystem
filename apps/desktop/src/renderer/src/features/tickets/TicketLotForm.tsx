import { Layers3 } from 'lucide-react';
import { useState } from 'react';

import type { CreateTicketLotInput } from '@gtrz/contracts';

interface TicketLotFormProps {
  readonly busy: boolean;
  readonly onSubmit: (input: CreateTicketLotInput) => Promise<void>;
}

function parseMoney(value: string): number {
  const amount = Number(value.trim().replace(',', '.'));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function TicketLotForm({ busy, onSubmit }: TicketLotFormProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [capacity, setCapacity] = useState('');

  return (
    <form
      className="ticket-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          name: name.trim(),
          priceCents: parseMoney(price),
          capacity: Number(capacity),
        }).then(() => {
          setName('');
          setPrice('');
          setCapacity('');
        });
      }}
    >
      <div className="panel__heading">
        <Layers3 size={20} aria-hidden="true" />
        <div>
          <h2>Novo lote</h2>
          <p>Defina preço e capacidade máxima antes de registrar vendas.</p>
        </div>
      </div>
      <label className="form-field">
        <span>Nome do lote</span>
        <input
          disabled={busy}
          maxLength={100}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder="Ex.: Segundo lote"
          required
          value={name}
        />
      </label>
      <div className="ticket-form__row">
        <label className="form-field">
          <span>Preço</span>
          <input
            disabled={busy}
            inputMode="decimal"
            onChange={(event) => {
              setPrice(event.target.value);
            }}
            placeholder="60,00"
            required
            value={price}
          />
        </label>
        <label className="form-field">
          <span>Capacidade</span>
          <input
            disabled={busy}
            min={1}
            onChange={(event) => {
              setCapacity(event.target.value);
            }}
            placeholder="200"
            required
            type="number"
            value={capacity}
          />
        </label>
      </div>
      <button
        className="button"
        disabled={busy || name.trim().length < 2 || parseMoney(price) < 0 || Number(capacity) <= 0}
        type="submit"
      >
        Criar lote
      </button>
    </form>
  );
}
