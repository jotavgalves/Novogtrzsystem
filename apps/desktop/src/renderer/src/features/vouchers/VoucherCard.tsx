import { Ban, CheckCircle2, Copy, Pencil, RefreshCw, Save, X } from 'lucide-react';
import { useState } from 'react';

import type {
  ServicePoint,
  UpdateVoucherInput,
  Voucher,
  VoucherDeletePreview,
} from '@gtrz/contracts';
import { formatCurrency, parseCurrencyInput } from '@gtrz/domain';

import { VoucherDeleteSection } from './VoucherDeleteSection';

interface VoucherCardProps {
  readonly voucher: Voucher;
  readonly busy: boolean;
  readonly servicePoints: readonly ServicePoint[];
  readonly onUpdate: (input: UpdateVoucherInput) => Promise<void>;
  readonly onPreviewDelete: (voucherId: string) => Promise<VoucherDeletePreview>;
  readonly onDelete: (voucherId: string, reason: string) => Promise<void>;
  readonly onChangeStatus: (voucherId: string, status: 'active' | 'cancelled') => Promise<void>;
}

const STATUS_LABELS = {
  active: 'Ativo',
  exhausted: 'Esgotado',
  cancelled: 'Desativado / excluído',
} as const;

export function VoucherCard({
  voucher,
  busy,
  servicePoints,
  onUpdate,
  onPreviewDelete,
  onDelete,
  onChangeStatus,
}: VoucherCardProps): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(voucher.label);
  const [code, setCode] = useState(voucher.code);
  const [linkedServicePointId, setLinkedServicePointId] = useState(
    voucher.linkedServicePointId ?? '',
  );
  const [addedBalance, setAddedBalance] = useState('');
  const addedBalanceCents = parseCurrencyInput(addedBalance);
  const bindingLocked = voucher.linkedServicePointId !== null;

  const resetEditState = (): void => {
    setLabel(voucher.label);
    setCode(voucher.code);
    setLinkedServicePointId(voucher.linkedServicePointId ?? '');
    setAddedBalance('');
  };

  return (
    <article className="voucher-card">
      <header className="voucher-card__header">
        <span>
          <strong>{voucher.label}</strong>
          <code>{voucher.code}</code>
        </span>
        <span
          className={
            voucher.status === 'active'
              ? 'status-badge status-badge--open'
              : 'status-badge status-badge--archived'
          }
        >
          {STATUS_LABELS[voucher.status]}
        </span>
      </header>

      <div className="voucher-card__balance">
        <span>Saldo disponível</span>
        <strong>{formatCurrency(voucher.remainingBalanceCents)}</strong>
        <small>Emitido com {formatCurrency(voucher.initialBalanceCents)}</small>
        <small>Mesa: {voucher.linkedServicePointLabel ?? 'aguardando novo vínculo'}</small>
      </div>

      <div className="voucher-card__actions">
        {!editing && voucher.status !== 'cancelled' ? (
          <button
            className="button button--ghost button--compact"
            disabled={busy}
            onClick={() => {
              setEditing(true);
              resetEditState();
            }}
            type="button"
          >
            <Pencil size={15} aria-hidden="true" />
            Editar
          </button>
        ) : null}
        <button
          className="button button--ghost button--compact"
          disabled={busy}
          onClick={() => {
            void navigator.clipboard.writeText(voucher.code);
          }}
          type="button"
        >
          <Copy size={15} aria-hidden="true" />
          Copiar código
        </button>
        {voucher.status === 'active' ? (
          <button
            className="button button--secondary button--compact"
            disabled={busy}
            onClick={() => {
              void onChangeStatus(voucher.id, 'cancelled');
            }}
            type="button"
          >
            <Ban size={15} aria-hidden="true" />
            Desativar
          </button>
        ) : null}
        <VoucherDeleteSection
          busy={busy}
          onDelete={onDelete}
          onPreviewDelete={onPreviewDelete}
          voucher={voucher}
        />
        {voucher.status === 'cancelled' && voucher.remainingBalanceCents > 0 ? (
          <button
            className="button button--secondary button--compact"
            disabled={busy}
            onClick={() => {
              void onChangeStatus(voucher.id, 'active');
            }}
            type="button"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Reativar
          </button>
        ) : null}
        {voucher.status === 'exhausted' ? (
          <span className="voucher-card__complete">
            <CheckCircle2 size={15} aria-hidden="true" />
            Saldo consumido
          </span>
        ) : null}
      </div>

      {editing ? (
        <form
          className="voucher-card__edit"
          onSubmit={(event) => {
            event.preventDefault();
            const input: UpdateVoucherInput = {
              voucherId: voucher.id,
              code: code.trim(),
              label: label.trim(),
              linkedServicePointId: linkedServicePointId.length === 0 ? null : linkedServicePointId,
              addedBalanceCents,
            };
            void onUpdate(input).then(() => {
              setEditing(false);
              setAddedBalance('');
            });
          }}
        >
          <label className="form-field">
            <span>Identificação</span>
            <input
              disabled={busy}
              maxLength={100}
              onChange={(event) => {
                setLabel(event.target.value);
              }}
              required
              value={label}
            />
          </label>
          <label className="form-field">
            <span>Código</span>
            <input
              disabled={busy}
              maxLength={32}
              onChange={(event) => {
                setCode(event.target.value.toLocaleUpperCase('pt-BR'));
              }}
              required
              value={code}
            />
          </label>
          <label className="form-field">
            <span>Mesa vinculada</span>
            <select
              disabled={busy || bindingLocked}
              onChange={(event) => {
                setLinkedServicePointId(event.target.value);
              }}
              value={linkedServicePointId}
            >
              {!bindingLocked ? <option value="">Selecione uma mesa</option> : null}
              {servicePoints.map((servicePoint) => (
                <option key={servicePoint.id} value={servicePoint.id}>
                  {servicePoint.label}
                </option>
              ))}
              {bindingLocked &&
              voucher.linkedServicePointId !== null &&
              !servicePoints.some((item) => item.id === voucher.linkedServicePointId) ? (
                <option value={voucher.linkedServicePointId}>
                  {voucher.linkedServicePointLabel ?? 'Mesa vinculada'}
                </option>
              ) : null}
            </select>
            <small>
              {bindingLocked
                ? 'Vínculo fixo. Se a mesa for excluída, o voucher será liberado para uma nova mesa.'
                : 'A mesa anterior foi excluída. Escolha uma nova mesa para reutilizar o voucher.'}
            </small>
          </label>
          <label className="form-field">
            <span>Acréscimo de saldo</span>
            <input
              disabled={busy}
              inputMode="decimal"
              onChange={(event) => {
                setAddedBalance(event.target.value);
              }}
              placeholder="0,00"
              value={addedBalance}
            />
          </label>
          <div className="voucher-card__actions">
            <button
              className="button button--secondary button--compact"
              disabled={
                busy ||
                label.trim().length < 2 ||
                code.trim().length < 4 ||
                (!bindingLocked && linkedServicePointId.length === 0)
              }
              type="submit"
            >
              <Save size={15} aria-hidden="true" />
              Salvar
            </button>
            <button
              className="button button--ghost button--compact"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                resetEditState();
              }}
              type="button"
            >
              <X size={15} aria-hidden="true" />
              Cancelar edição
            </button>
          </div>
        </form>
      ) : null}
    </article>
  );
}