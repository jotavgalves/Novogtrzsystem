import {
  Archive,
  CalendarDays,
  Check,
  CirclePlay,
  Pencil,
  RotateCcw,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';

import type { EventStatus, GtrzEvent } from '@gtrz/contracts';

interface EventCardProps {
  readonly event: GtrzEvent;
  readonly isActive: boolean;
  readonly busy: boolean;
  readonly onSelect: (eventId: string) => Promise<void>;
  readonly onRename: (eventId: string, name: string) => Promise<void>;
  readonly onRequestClose: (eventId: string) => void;
  readonly onChangeStatus: (eventId: string, status: EventStatus) => Promise<void>;
  readonly onDelete: (eventId: string) => Promise<void>;
}

const STATUS_LABELS: Readonly<Record<EventStatus, string>> = {
  open: 'Aberto',
  closed: 'Encerrado',
  archived: 'Arquivado',
};

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp);
}

export function EventCard({
  event,
  isActive,
  busy,
  onSelect,
  onRename,
  onRequestClose,
  onChangeStatus,
  onDelete,
}: EventCardProps): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [name, setName] = useState(event.name);

  async function submitRename(formEvent: SyntheticEvent<HTMLFormElement>): Promise<void> {
    formEvent.preventDefault();
    await onRename(event.id, name);
    setEditing(false);
  }

  return (
    <article className={isActive ? 'event-card event-card--active' : 'event-card'}>
      <div className="event-card__header">
        <span className={`status-badge status-badge--${event.status}`}>
          {STATUS_LABELS[event.status]}
        </span>
        {isActive ? <span className="status-badge status-badge--selected">Em operação</span> : null}
      </div>

      {editing ? (
        <form className="inline-edit" onSubmit={(formEvent) => void submitRename(formEvent)}>
          <input
            autoFocus
            maxLength={100}
            minLength={2}
            onChange={(inputEvent) => {
              setName(inputEvent.target.value);
            }}
            required
            value={name}
          />
          <button className="icon-button icon-button--success" disabled={busy} type="submit">
            <Check size={17} aria-label="Salvar nome" />
          </button>
          <button
            className="icon-button"
            disabled={busy}
            onClick={() => {
              setName(event.name);
              setEditing(false);
            }}
            type="button"
          >
            <X size={17} aria-label="Cancelar edição" />
          </button>
        </form>
      ) : (
        <div className="event-card__title-row">
          <h2>{event.name}</h2>
          <button
            className="icon-button"
            disabled={busy}
            onClick={() => {
              setEditing(true);
            }}
            type="button"
          >
            <Pencil size={16} aria-label="Editar nome" />
          </button>
        </div>
      )}

      <p className="event-card__date">
        <CalendarDays size={17} aria-hidden="true" />
        {formatDate(event.startsAt)}
      </p>

      <div className="event-card__actions">
        {event.status === 'open' && !isActive ? (
          <button
            className="button button--primary button--compact"
            disabled={busy}
            onClick={() => {
              void onSelect(event.id);
            }}
            type="button"
          >
            <CirclePlay size={16} aria-hidden="true" />
            Operar evento
          </button>
        ) : null}

        {event.status === 'open' && isActive ? (
          <button
            className="button button--secondary button--compact"
            disabled={busy}
            onClick={() => {
              onRequestClose(event.id);
            }}
            type="button"
          >
            <Square size={15} aria-hidden="true" />
            Encerrar
          </button>
        ) : null}

        {event.status === 'closed' ? (
          <>
            <button
              className="button button--secondary button--compact"
              disabled={busy}
              onClick={() => {
                void onChangeStatus(event.id, 'open');
              }}
              type="button"
            >
              <RotateCcw size={16} aria-hidden="true" />
              Reabrir
            </button>
            <button
              className="button button--ghost button--compact"
              disabled={busy}
              onClick={() => {
                void onChangeStatus(event.id, 'archived');
              }}
              type="button"
            >
              <Archive size={16} aria-hidden="true" />
              Arquivar
            </button>
          </>
        ) : null}

        {event.status === 'archived' ? (
          <button
            className="button button--ghost button--compact"
            disabled={busy}
            onClick={() => {
              void onChangeStatus(event.id, 'closed');
            }}
            type="button"
          >
            <RotateCcw size={16} aria-hidden="true" />
            Restaurar histórico
          </button>
        ) : null}

        <button
          className="button button--ghost button--compact"
          disabled={busy}
          onClick={() => {
            setConfirmingDelete(true);
          }}
          type="button"
        >
          <Trash2 size={16} aria-hidden="true" />
          Apagar
        </button>
      </div>

      {confirmingDelete ? (
        <div className="event-delete-confirmation">
          <p>
            O evento sairá da lista, mas histórico, caixa, estoque e auditoria serão preservados.
          </p>
          <div>
            <button
              className="button button--danger button--compact"
              disabled={busy}
              onClick={() => {
                void onDelete(event.id);
              }}
              type="button"
            >
              Confirmar apagar
            </button>
            <button
              className="button button--ghost button--compact"
              disabled={busy}
              onClick={() => {
                setConfirmingDelete(false);
              }}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
