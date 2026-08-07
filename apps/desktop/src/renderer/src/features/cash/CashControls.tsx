import { ArrowDownToLine, ArrowUpFromLine, LockKeyhole, UnlockKeyhole } from 'lucide-react';
import { useState } from 'react';

import type { RecordCashMovementInput } from '@gtrz/contracts';

interface CashControlsProps {
  readonly status: 'not-opened' | 'open' | 'closed';
  readonly busy: boolean;
  readonly onOpen: (openingCashCents: number) => Promise<void>;
  readonly onMovement: (input: RecordCashMovementInput) => Promise<void>;
  readonly onClose: (countedCashCents: number) => Promise<void>;
}

function parseMoney(value: string): number {
  const amount = Number(value.trim().replace(',', '.'));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function CashControls({
  status,
  busy,
  onOpen,
  onMovement,
  onClose,
}: CashControlsProps): React.JSX.Element {
  const [opening, setOpening] = useState('');
  const [movementType, setMovementType] = useState<'supply' | 'withdrawal'>('supply');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementNote, setMovementNote] = useState('');
  const [counted, setCounted] = useState('');

  if (status === 'not-opened') {
    return (
      <article className="panel finance-control-card">
        <div className="panel__heading">
          <UnlockKeyhole size={20} aria-hidden="true" />
          <div>
            <h2>Abrir caixa</h2>
            <p>Informe o dinheiro físico existente no início da operação.</p>
          </div>
        </div>
        <form
          className="finance-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onOpen(parseMoney(opening));
          }}
        >
          <label className="form-field">
            <span>Saldo de abertura</span>
            <input
              disabled={busy}
              inputMode="decimal"
              onChange={(event) => {
                setOpening(event.target.value);
              }}
              placeholder="0,00"
              value={opening}
            />
          </label>
          <button className="button" disabled={busy || parseMoney(opening) < 0} type="submit">
            Abrir caixa
          </button>
        </form>
      </article>
    );
  }

  if (status === 'closed') {
    return (
      <article className="panel finance-control-card finance-control-card--closed">
        <LockKeyhole size={24} aria-hidden="true" />
        <div>
          <h2>Caixa encerrado</h2>
          <p>O fechamento deste evento já foi registrado e não pode ser reaberto.</p>
        </div>
      </article>
    );
  }

  return (
    <div className="finance-control-grid">
      <article className="panel finance-control-card">
        <div className="panel__heading">
          {movementType === 'supply' ? (
            <ArrowDownToLine size={20} aria-hidden="true" />
          ) : (
            <ArrowUpFromLine size={20} aria-hidden="true" />
          )}
          <div>
            <h2>Movimentação administrativa</h2>
            <p>Suprimentos aumentam e retiradas reduzem o caixa físico esperado.</p>
          </div>
        </div>
        <form
          className="finance-movement-form"
          onSubmit={(event) => {
            event.preventDefault();
            const note = movementNote.trim();
            const input =
              note.length === 0
                ? { type: movementType, amountCents: parseMoney(movementAmount) }
                : { type: movementType, amountCents: parseMoney(movementAmount), note };
            void onMovement(input).then(() => {
              setMovementAmount('');
              setMovementNote('');
            });
          }}
        >
          <label className="form-field">
            <span>Tipo</span>
            <select
              disabled={busy}
              onChange={(event) => {
                setMovementType(event.target.value as 'supply' | 'withdrawal');
              }}
              value={movementType}
            >
              <option value="supply">Suprimento</option>
              <option value="withdrawal">Retirada</option>
            </select>
          </label>
          <label className="form-field">
            <span>Valor</span>
            <input
              disabled={busy}
              inputMode="decimal"
              onChange={(event) => {
                setMovementAmount(event.target.value);
              }}
              placeholder="0,00"
              value={movementAmount}
            />
          </label>
          <label className="form-field finance-note-field">
            <span>Observação</span>
            <input
              disabled={busy}
              maxLength={240}
              onChange={(event) => {
                setMovementNote(event.target.value);
              }}
              placeholder="Ex.: reforço de troco"
              value={movementNote}
            />
          </label>
          <button
            className="button"
            disabled={busy || parseMoney(movementAmount) <= 0}
            type="submit"
          >
            Registrar
          </button>
        </form>
      </article>

      <article className="panel finance-control-card">
        <div className="panel__heading">
          <LockKeyhole size={20} aria-hidden="true" />
          <div>
            <h2>Fechar caixa</h2>
            <p>O sistema compara o valor contado com o caixa físico esperado.</p>
          </div>
        </div>
        <form
          className="finance-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onClose(parseMoney(counted));
          }}
        >
          <label className="form-field">
            <span>Dinheiro contado</span>
            <input
              disabled={busy}
              inputMode="decimal"
              onChange={(event) => {
                setCounted(event.target.value);
              }}
              placeholder="0,00"
              value={counted}
            />
          </label>
          <button className="button" disabled={busy || parseMoney(counted) < 0} type="submit">
            Fechar caixa
          </button>
        </form>
      </article>
    </div>
  );
}
