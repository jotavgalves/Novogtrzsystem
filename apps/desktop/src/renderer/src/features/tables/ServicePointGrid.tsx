import {
  Armchair,
  CheckCircle2,
  Pin,
  PinOff,
  RotateCcw,
  ShoppingBasket,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';

import type {
  ServicePoint,
  ServicePointDeleteMode,
  ServicePointDeletePreview,
} from '@gtrz/contracts';
import { formatCurrency } from '@gtrz/domain';

interface ServicePointGridProps {
  readonly servicePoints: readonly ServicePoint[];
  readonly busy: boolean;
  readonly production: boolean;
  readonly onOpen: (servicePoint: ServicePoint) => Promise<void>;
  readonly onPinChange: (servicePointId: string, pinned: boolean) => Promise<void>;
  readonly onPreviewDelete: (servicePointId: string) => Promise<ServicePointDeletePreview>;
  readonly onDelete: (
    servicePointId: string,
    mode: ServicePointDeleteMode,
    reason: string,
  ) => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível excluir a mesa.';
}

export function ServicePointGrid({
  servicePoints,
  busy,
  production,
  onOpen,
  onPinChange,
  onPreviewDelete,
  onDelete,
}: ServicePointGridProps): React.JSX.Element {
  const [deletePreview, setDeletePreview] = useState<ServicePointDeletePreview | null>(null);
  const [deleteMode, setDeleteMode] = useState<ServicePointDeleteMode>('keep-sales');
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  async function requestDelete(servicePointId: string): Promise<void> {
    setLocalError(null);

    try {
      const preview = await onPreviewDelete(servicePointId);
      setDeletePreview(preview);
      setDeleteMode('keep-sales');
      setReason('');
    } catch (error: unknown) {
      setLocalError(getErrorMessage(error));
    }
  }

  async function confirmDelete(): Promise<void> {
    if (deletePreview === null) {
      return;
    }

    setLocalError(null);

    try {
      await onDelete(deletePreview.servicePointId, deleteMode, reason);
      setDeletePreview(null);
      setDeleteMode('keep-sales');
      setReason('');
    } catch (error: unknown) {
      setLocalError(getErrorMessage(error));
    }
  }

  function cancelDelete(): void {
    setDeletePreview(null);
    setDeleteMode('keep-sales');
    setReason('');
    setLocalError(null);
  }

  return (
    <>
      <div className="service-point-grid" aria-live="polite">
        {servicePoints.map((servicePoint) => {
          const Icon = servicePoint.type === 'counter' ? ShoppingBasket : Armchair;
          const open = servicePoint.status === 'open';

          return (
            <div
              className={
                servicePoint.pinned
                  ? 'service-point-entry service-point-entry--pinned'
                  : 'service-point-entry'
              }
              key={servicePoint.id}
            >
              <button
                className={
                  open ? 'service-point-card service-point-card--open' : 'service-point-card'
                }
                disabled={busy}
                onClick={() => {
                  void onOpen(servicePoint);
                }}
                type="button"
              >
                <span className="service-point-card__icon">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <span className="service-point-card__body">
                  <strong>{servicePoint.label}</strong>
                  <small>
                    {servicePoint.type === 'counter' ? 'Venda imediata' : 'Atendimento por mesa'}
                  </small>
                </span>
                <span className={open ? 'status-badge status-badge--open' : 'status-badge'}>
                  {open ? formatCurrency(servicePoint.activeOrderTotalCents) : 'Livre'}
                </span>
              </button>

              {servicePoint.type === 'table' ? (
                <button
                  aria-label={
                    servicePoint.pinned
                      ? `Desafixar ${servicePoint.label}`
                      : `Fixar ${servicePoint.label}`
                  }
                  className={
                    servicePoint.pinned
                      ? 'service-point-pin-trigger service-point-pin-trigger--active'
                      : 'service-point-pin-trigger'
                  }
                  disabled={busy}
                  onClick={() => {
                    void onPinChange(servicePoint.id, !servicePoint.pinned);
                  }}
                  title={servicePoint.pinned ? 'Desafixar mesa' : 'Fixar mesa'}
                  type="button"
                >
                  {servicePoint.pinned ? (
                    <PinOff size={16} aria-hidden="true" />
                  ) : (
                    <Pin size={16} aria-hidden="true" />
                  )}
                </button>
              ) : null}

              {production && servicePoint.type === 'table' ? (
                <button
                  aria-label={`Excluir ${servicePoint.label}`}
                  className="service-point-delete-trigger"
                  disabled={busy}
                  onClick={() => {
                    void requestDelete(servicePoint.id);
                  }}
                  title={`Excluir ${servicePoint.label}`}
                  type="button"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {deletePreview === null ? null : (
        <article className="panel service-point-delete-panel" aria-live="polite">
          <div className="service-point-delete-panel__heading">
            <div>
              <span className="eyebrow">Exclusão de mesa</span>
              <h2>Excluir {deletePreview.label}?</h2>
              <p>
                Escolha o que fazer com as vendas já concluídas. Se existir uma comanda aberta, ela
                será cancelada nos dois modos antes de a mesa sair da operação.
              </p>
            </div>
            <button
              aria-label="Fechar confirmação"
              className="icon-button"
              disabled={busy}
              onClick={cancelDelete}
              type="button"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>

          <div className="service-point-delete-impact">
            <span>
              <small>Vendas concluídas</small>
              <strong>{deletePreview.paidOrders}</strong>
            </span>
            <span>
              <small>Valor das vendas</small>
              <strong>{formatCurrency(deletePreview.paidSalesCents)}</strong>
            </span>
            <span>
              <small>Consumido em voucher</small>
              <strong>{formatCurrency(deletePreview.voucherConsumedCents)}</strong>
            </span>
            <span>
              <small>Comandas abertas</small>
              <strong>{deletePreview.openOrders}</strong>
            </span>
          </div>

          <div className="service-point-delete-options">
            <label
              className={
                deleteMode === 'keep-sales'
                  ? 'service-point-delete-option service-point-delete-option--selected'
                  : 'service-point-delete-option'
              }
            >
              <input
                checked={deleteMode === 'keep-sales'}
                disabled={busy}
                name="service-point-delete-mode"
                onChange={() => {
                  setDeleteMode('keep-sales');
                }}
                type="radio"
              />
              <CheckCircle2 size={20} aria-hidden="true" />
              <span>
                <strong>Manter todas as vendas</strong>
                <small>
                  As vendas continuam no faturamento. Estoque vendido e saldo já consumido de
                  vouchers não voltam.
                </small>
              </span>
            </label>

            <label
              className={
                deleteMode === 'refund-sales'
                  ? 'service-point-delete-option service-point-delete-option--selected'
                  : 'service-point-delete-option'
              }
            >
              <input
                checked={deleteMode === 'refund-sales'}
                disabled={busy}
                name="service-point-delete-mode"
                onChange={() => {
                  setDeleteMode('refund-sales');
                }}
                type="radio"
              />
              <RotateCcw size={20} aria-hidden="true" />
              <span>
                <strong>Estornar todas as vendas</strong>
                <small>
                  Todas as vendas pagas dessa mesa são canceladas. O estoque retorna e o saldo
                  consumido dos vouchers é devolvido.
                </small>
              </span>
            </label>
          </div>

          {deletePreview.linkedVouchers > 0 ? (
            <p className="service-point-delete-note">
              {deletePreview.linkedVouchers} voucher(es) ainda vinculados à mesa serão desvinculados
              para continuar disponíveis sem apontar para uma mesa excluída.
            </p>
          ) : null}

          <label className="form-field service-point-delete-reason">
            <span>Motivo da exclusão</span>
            <textarea
              disabled={busy}
              maxLength={240}
              minLength={3}
              onChange={(event) => {
                setReason(event.target.value);
              }}
              placeholder="Ex.: mesa cadastrada por engano ou retirada do mapa do evento"
              rows={3}
              value={reason}
            />
          </label>

          {localError === null ? null : <p className="form-error">{localError}</p>}

          <div className="service-point-delete-actions">
            <button
              className="button button--danger"
              disabled={busy || reason.trim().length < 3}
              onClick={() => {
                void confirmDelete();
              }}
              type="button"
            >
              <Trash2 size={16} aria-hidden="true" />
              {deleteMode === 'refund-sales'
                ? 'Excluir e estornar vendas'
                : 'Excluir e manter vendas'}
            </button>
            <button
              className="button button--ghost"
              disabled={busy}
              onClick={cancelDelete}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </article>
      )}
    </>
  );
}
