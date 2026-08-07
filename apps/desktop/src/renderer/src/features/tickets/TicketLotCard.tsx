import { Pencil, Save, Ticket } from 'lucide-react';
import { useState } from 'react';

import type { TicketLot, UpdateTicketLotInput } from '@gtrz/contracts';

interface TicketLotCardProps {
  readonly lot: TicketLot;
  readonly busy: boolean;
  readonly onUpdate: (input: UpdateTicketLotInput) => Promise<void>;
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function parseMoney(value: string): number {
  const amount = Number(value.trim().replace(',', '.'));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function TicketLotCard({ lot, busy, onUpdate }: TicketLotCardProps): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(lot.name);
  const [price, setPrice] = useState(String(lot.priceCents / 100));
  const [capacity, setCapacity] = useState(String(lot.capacity));
  const consumed = lot.soldQuantity + lot.courtesyQuantity;

  return (
    <article
      className={lot.active ? 'ticket-lot-card' : 'ticket-lot-card ticket-lot-card--inactive'}
    >
      <header className="ticket-lot-card__header">
        <span>
          <Ticket size={18} aria-hidden="true" />
          <strong>{lot.name}</strong>
        </span>
        <span
          className={
            lot.active ? 'status-badge status-badge--open' : 'status-badge status-badge--archived'
          }
        >
          {lot.active ? 'Ativo' : 'Inativo'}
        </span>
      </header>

      <div className="ticket-lot-card__metrics">
        <span>
          <small>Preço</small>
          <strong>{formatMoney(lot.priceCents)}</strong>
        </span>
        <span>
          <small>Vendidos</small>
          <strong>{lot.soldQuantity}</strong>
        </span>
        <span>
          <small>Cortesias</small>
          <strong>{lot.courtesyQuantity}</strong>
        </span>
        <span>
          <small>Disponíveis</small>
          <strong>{lot.availableQuantity}</strong>
        </span>
      </div>

      <div
        className="ticket-capacity-bar"
        aria-label={`${String(consumed)} de ${String(lot.capacity)} utilizados`}
      >
        <span style={{ width: `${String(Math.min((consumed / lot.capacity) * 100, 100))}%` }} />
      </div>

      {editing ? (
        <form
          className="ticket-lot-edit"
          onSubmit={(event) => {
            event.preventDefault();
            void onUpdate({
              lotId: lot.id,
              name: name.trim(),
              priceCents: parseMoney(price),
              capacity: Number(capacity),
              active: lot.active,
            }).then(() => {
              setEditing(false);
            });
          }}
        >
          <input
            aria-label="Nome do lote"
            disabled={busy}
            onChange={(event) => {
              setName(event.target.value);
            }}
            value={name}
          />
          <input
            aria-label="Preço do lote"
            disabled={busy}
            inputMode="decimal"
            onChange={(event) => {
              setPrice(event.target.value);
            }}
            value={price}
          />
          <input
            aria-label="Capacidade do lote"
            disabled={busy}
            min={consumed}
            onChange={(event) => {
              setCapacity(event.target.value);
            }}
            type="number"
            value={capacity}
          />
          <button className="button button--compact" disabled={busy} type="submit">
            <Save size={15} aria-hidden="true" />
            Salvar
          </button>
        </form>
      ) : (
        <div className="ticket-lot-card__actions">
          <button
            className="button button--ghost button--compact"
            disabled={busy}
            onClick={() => {
              setEditing(true);
            }}
            type="button"
          >
            <Pencil size={15} aria-hidden="true" />
            Editar
          </button>
          <button
            className="button button--secondary button--compact"
            disabled={busy}
            onClick={() => {
              void onUpdate({
                lotId: lot.id,
                name: lot.name,
                priceCents: lot.priceCents,
                capacity: lot.capacity,
                active: !lot.active,
              });
            }}
            type="button"
          >
            {lot.active ? 'Desativar' : 'Ativar'}
          </button>
        </div>
      )}
    </article>
  );
}
