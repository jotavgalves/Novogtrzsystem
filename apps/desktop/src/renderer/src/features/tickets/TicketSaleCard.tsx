import { Ban, Copy, Gift, TicketCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { TicketSale } from '@gtrz/contracts';

interface TicketSaleCardProps {
  readonly sale: TicketSale;
  readonly busy: boolean;
  readonly onCancel: (saleId: string, reason: string) => Promise<void>;
  readonly onCancelCode: (codeId: string, reason: string) => Promise<void>;
  readonly onDeleteSale: (saleId: string, reason: string) => Promise<void>;
  readonly onDeleteCode: (codeId: string, reason: string) => Promise<void>;
}

const SOURCE_LABELS = {
  sympla: 'Sympla',
  whatsapp: 'WhatsApp',
  door: 'Porta',
  courtesy: 'Cortesia',
} as const;

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function TicketSaleCard({
  sale,
  busy,
  onCancel,
  onCancelCode,
  onDeleteSale,
  onDeleteCode,
}: TicketSaleCardProps): React.JSX.Element {
  const [reason, setReason] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [codeReasons, setCodeReasons] = useState<Readonly<Record<string, string>>>({});

  return (
    <article className="ticket-sale-card">
      <header className="ticket-sale-card__header">
        <span>
          {sale.source === 'courtesy' ? (
            <Gift size={18} aria-hidden="true" />
          ) : (
            <TicketCheck size={18} aria-hidden="true" />
          )}
          <span>
            <strong>{sale.attendeeName}</strong>
            <small>
              {sale.lotName} · {SOURCE_LABELS[sale.source]}
            </small>
          </span>
        </span>
        <span
          className={
            sale.status === 'active'
              ? 'status-badge status-badge--open'
              : 'status-badge status-badge--archived'
          }
        >
          {sale.status === 'active' ? 'Ativa' : 'Cancelada'}
        </span>
      </header>

      <div className="ticket-sale-card__summary">
        <span>
          <small>Quantidade</small>
          <strong>{sale.quantity}</strong>
        </span>
        <span>
          <small>Unitário</small>
          <strong>{formatMoney(sale.unitPriceCents)}</strong>
        </span>
        <span>
          <small>Total</small>
          <strong>{formatMoney(sale.totalCents)}</strong>
        </span>
      </div>

      <div className="ticket-code-list">
        {sale.codes.map((ticketCode) => {
          const codeReason = codeReasons[ticketCode.id] ?? '';
          return (
            <div
              className={
                ticketCode.status === 'valid'
                  ? 'ticket-code-control'
                  : 'ticket-code-control ticket-code-control--cancelled'
              }
              key={ticketCode.id}
            >
              <button
                className="ticket-code"
                disabled={busy}
                onClick={() => {
                  void navigator.clipboard.writeText(ticketCode.code);
                }}
                type="button"
              >
                <code>{ticketCode.code}</code>
                <Copy size={14} aria-hidden="true" />
              </button>

              <input
                aria-label={`Motivo da ação no ingresso ${ticketCode.code}`}
                disabled={busy}
                maxLength={240}
                onChange={(event) => {
                  setCodeReasons((current) => ({
                    ...current,
                    [ticketCode.id]: event.target.value,
                  }));
                }}
                placeholder="Motivo"
                value={codeReason}
              />

              <div className="ticket-code-control__actions">
                {sale.status === 'active' && ticketCode.status === 'valid' ? (
                  <button
                    className="button button--ghost button--compact"
                    disabled={busy || codeReason.trim().length < 3}
                    onClick={() => {
                      void onCancelCode(ticketCode.id, codeReason.trim()).then(() => {
                        setCodeReasons((current) => ({ ...current, [ticketCode.id]: '' }));
                      });
                    }}
                    type="button"
                  >
                    <Ban size={15} aria-hidden="true" />
                    Cancelar
                  </button>
                ) : null}
                <button
                  className="button button--danger button--compact"
                  disabled={busy || codeReason.trim().length < 3}
                  onClick={() => {
                    void onDeleteCode(ticketCode.id, codeReason.trim()).then(() => {
                      setCodeReasons((current) => ({ ...current, [ticketCode.id]: '' }));
                    });
                  }}
                  type="button"
                >
                  <Trash2 size={15} aria-hidden="true" />
                  Excluir ingresso
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="ticket-sale-card__admin">
        {sale.status === 'active' ? (
          <form
            className="ticket-sale-cancel"
            onSubmit={(event) => {
              event.preventDefault();
              const normalizedReason = reason.trim();

              if (normalizedReason.length < 3) {
                return;
              }

              void onCancel(sale.id, normalizedReason).then(() => {
                setReason('');
              });
            }}
          >
            <label className="form-field">
              <span>Cancelar sem excluir</span>
              <input
                disabled={busy}
                maxLength={240}
                onChange={(event) => {
                  setReason(event.target.value);
                }}
                placeholder="Ex.: venda duplicada"
                value={reason}
              />
            </label>
            <button
              className="button button--secondary"
              disabled={busy || reason.trim().length < 3}
              type="submit"
            >
              <Ban size={15} aria-hidden="true" />
              Cancelar venda
            </button>
          </form>
        ) : null}

        <form
          className="ticket-sale-cancel ticket-sale-delete"
          onSubmit={(event) => {
            event.preventDefault();
            const normalizedReason = deleteReason.trim();

            if (normalizedReason.length < 3) {
              return;
            }

            void onDeleteSale(sale.id, normalizedReason).then(() => {
              setDeleteReason('');
            });
          }}
        >
          <label className="form-field">
            <span>{sale.status === 'active' ? 'Excluir e estornar' : 'Excluir registro'}</span>
            <input
              disabled={busy}
              maxLength={240}
              onChange={(event) => {
                setDeleteReason(event.target.value);
              }}
              placeholder="Motivo da exclusão"
              value={deleteReason}
            />
          </label>
          <button
            className="button button--danger"
            disabled={busy || deleteReason.trim().length < 3}
            type="submit"
          >
            <Trash2 size={15} aria-hidden="true" />
            {sale.status === 'active' ? 'Excluir venda' : 'Excluir registro'}
          </button>
        </form>
      </div>
    </article>
  );
}
