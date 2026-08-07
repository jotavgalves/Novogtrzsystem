import { RefreshCw, Ticket, TriangleAlert } from 'lucide-react';

import { formatCurrency } from '@gtrz/domain';

import { VoucherCard } from './VoucherCard';
import { VoucherForm } from './VoucherForm';
import { VoucherHistory } from './VoucherHistory';
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
  const vouchers = state?.vouchers ?? [];
  const transactions = state?.transactions ?? [];
  const activeVouchers = vouchers.filter((voucher) => voucher.status === 'active');
  const cancelledVouchers = vouchers.filter((voucher) => voucher.status === 'cancelled');
  const availableCents = activeVouchers.reduce(
    (total, voucher) => total + voucher.remainingBalanceCents,
    0,
  );

  return (
    <section className="feature-page">
      <header className="feature-header">
        <div>
          <span className="eyebrow">Crédito controlado por evento</span>
          <h1>Vouchers</h1>
          <p>Emita créditos, acompanhe saldos individuais e audite cada uso ou restituição.</p>
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
          <span>Vouchers ativos</span>
          <strong>{activeVouchers.length}</strong>
        </article>
        <article className="summary-card summary-card--accent">
          <span>Saldo disponível</span>
          <strong>{formatCurrency(availableCents)}</strong>
        </article>
        <article className="summary-card">
          <span>Cancelados</span>
          <strong>{cancelledVouchers.length}</strong>
        </article>
        <article className="summary-card">
          <span>Movimentações</span>
          <strong>{transactions.length}</strong>
        </article>
      </div>

      {state?.activeEventId === null || state === null ? (
        <div className="inventory-warning">
          <TriangleAlert size={19} aria-hidden="true" />
          <span>Selecione um evento aberto antes de emitir vouchers.</span>
        </div>
      ) : null}

      {error === null ? null : <p className="form-error">{error}</p>}
      {message === null ? null : <p className="form-success">{message}</p>}

      {state?.activeEventId !== null && state !== null ? (
        <div className="voucher-layout">
          <article className="panel">
            <VoucherForm busy={busy} onSubmit={createVoucher} servicePoints={state.servicePoints} />
          </article>
          <div className="voucher-list" aria-live="polite">
            {loading ? <div className="route-state">Carregando vouchers…</div> : null}
            {!loading && vouchers.length === 0 ? (
              <div className="empty-state">
                <Ticket size={32} aria-hidden="true" />
                <h2>Nenhum voucher emitido</h2>
                <p>Emita o primeiro crédito para o evento ativo.</p>
              </div>
            ) : null}
            {vouchers.map((voucher) => (
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
        </div>
      ) : null}

      {state?.activeEventId !== null && state !== null ? (
        <VoucherHistory transactions={transactions} />
      ) : null}
    </section>
  );
}
