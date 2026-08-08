import { CreditCard, RefreshCw, TicketCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { formatCurrency } from '@gtrz/domain';

import { VoucherCard } from './VoucherCard';
import { VoucherForm } from './VoucherForm';
import { useVouchers } from './useVouchers';

export function VouchersPage(): React.JSX.Element {
  const {
    state,
    loading,
    busy,
    error,
    message,
    reload,
    createVoucher,
    updateVoucher,
    previewDeleteVoucher,
    deleteVoucher,
    changeStatus,
  } = useVouchers();
  const [showDeleted, setShowDeleted] = useState(false);
  const vouchers = state?.vouchers ?? [];
  const operationalVouchers = vouchers.filter((voucher) => voucher.status !== 'cancelled');
  const deletedVouchers = vouchers.filter((voucher) => voucher.status === 'cancelled');
  const visibleVouchers = showDeleted ? deletedVouchers : operationalVouchers;
  const activeBalanceCents = operationalVouchers.reduce(
    (total, voucher) => total + voucher.remainingBalanceCents,
    0,
  );
  const usedBalanceCents = operationalVouchers.reduce(
    (total, voucher) => total + (voucher.initialBalanceCents - voucher.remainingBalanceCents),
    0,
  );
  const initialLoading = loading && state === null;

  return (
    <section className="feature-page">
      <header className="feature-header">
        <div>
          <span className="eyebrow">Créditos vinculados às mesas</span>
          <h1>Vouchers</h1>
          <p>Emita, use e exclua créditos sem permitir o mesmo voucher em duas mesas.</p>
        </div>
        <button
          className="button button--secondary"
          disabled={loading || busy}
          onClick={() => {
            void reload();
          }}
          type="button"
        >
          <RefreshCw size={17} aria-hidden="true" />
          Atualizar
        </button>
      </header>

      <div className="summary-grid summary-grid--compact">
        <article className="summary-card">
          <span>Vouchers operacionais</span>
          <strong>{operationalVouchers.length}</strong>
        </article>
        <article className="summary-card">
          <span>Saldo disponível</span>
          <strong>{formatCurrency(activeBalanceCents)}</strong>
        </article>
        <article className="summary-card">
          <span>Saldo já usado</span>
          <strong>{formatCurrency(usedBalanceCents)}</strong>
        </article>
        <article className="summary-card summary-card--accent">
          <span>Excluídos no histórico</span>
          <strong>{deletedVouchers.length}</strong>
        </article>
      </div>

      {initialLoading ? <div className="route-state">Carregando vouchers…</div> : null}

      {!initialLoading && (state?.activeEventId === null || state === null) ? (
        <div className="inventory-warning">
          <TriangleAlert size={19} aria-hidden="true" />
          <span>Selecione um evento aberto antes de administrar vouchers.</span>
        </div>
      ) : null}

      {error === null ? null : <p className="form-error">{error}</p>}
      {message === null ? null : <p className="form-success">{message}</p>}

      {state?.activeEventId !== null && state !== null ? (
        <>
          <article className="panel">
            <VoucherForm busy={busy} onSubmit={createVoucher} servicePoints={state.servicePoints} />
          </article>

          <div className="voucher-view-toggle">
            <button
              aria-pressed={!showDeleted}
              className={
                !showDeleted ? 'button button--secondary is-active' : 'button button--ghost'
              }
              onClick={() => {
                setShowDeleted(false);
              }}
              type="button"
            >
              <CreditCard size={16} aria-hidden="true" />
              Operacionais ({operationalVouchers.length})
            </button>
            <button
              aria-pressed={showDeleted}
              className={
                showDeleted ? 'button button--secondary is-active' : 'button button--ghost'
              }
              onClick={() => {
                setShowDeleted(true);
              }}
              type="button"
            >
              <TicketCheck size={16} aria-hidden="true" />
              Excluídos ({deletedVouchers.length})
            </button>
          </div>

          <div className="voucher-list" aria-live="polite">
            {loading && vouchers.length === 0 ? (
              <div className="route-state">Carregando vouchers…</div>
            ) : null}
            {!loading && visibleVouchers.length === 0 ? (
              <div className="empty-state">
                <CreditCard size={32} aria-hidden="true" />
                <h2>{showDeleted ? 'Nenhum voucher excluído' : 'Nenhum voucher operacional'}</h2>
                <p>
                  {showDeleted
                    ? 'Vouchers nunca utilizados podem ser apagados definitivamente e não aparecem aqui.'
                    : 'Emita o primeiro voucher para uma mesa do evento.'}
                </p>
              </div>
            ) : null}
            {visibleVouchers.map((voucher) => (
              <VoucherCard
                busy={busy}
                key={voucher.id}
                onChangeStatus={changeStatus}
                onDelete={deleteVoucher}
                onPreviewDelete={previewDeleteVoucher}
                onUpdate={updateVoucher}
                servicePoints={state.servicePoints}
                voucher={voucher}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
