import { Archive, RefreshCw, Ticket, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { formatCurrency } from '@gtrz/domain';

import { TicketLotCard } from './TicketLotCard';
import { TicketLotForm } from './TicketLotForm';
import { TicketSaleCard } from './TicketSaleCard';
import { TicketSaleForm } from './TicketSaleForm';
import { useTickets } from './useTickets';

export function TicketsPage(): React.JSX.Element {
  const {
    state,
    loading,
    busy,
    error,
    message,
    reload,
    createLot,
    updateLot,
    createSale,
    cancelSale,
    cancelCode,
    deleteLot,
    deleteSale,
    deleteCode,
  } = useTickets();
  const [showArchivedLots, setShowArchivedLots] = useState(false);
  const lots = state?.lots ?? [];
  const activeLots = lots.filter((lot) => lot.active);
  const archivedLots = lots.filter((lot) => !lot.active);
  const visibleLots = showArchivedLots ? archivedLots : activeLots;
  const sales = state?.sales ?? [];
  const activeSales = sales.filter((sale) => sale.status === 'active');
  const soldQuantity = activeSales
    .filter((sale) => sale.source !== 'courtesy')
    .reduce((total, sale) => total + sale.quantity, 0);
  const courtesyQuantity = activeSales
    .filter((sale) => sale.source === 'courtesy')
    .reduce((total, sale) => total + sale.quantity, 0);
  const availableQuantity = activeLots.reduce((total, lot) => total + lot.availableQuantity, 0);
  const initialLoading = loading && state === null;

  return (
    <section className="feature-page">
      <header className="feature-header">
        <div>
          <span className="eyebrow">Lotes, códigos e receita integrados</span>
          <h1>Ingressos</h1>
          <p>Controle capacidade, vendas em grupo, cortesias e códigos individuais por evento.</p>
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
          <span>Ingressos vendidos</span>
          <strong>{soldQuantity}</strong>
        </article>
        <article className="summary-card">
          <span>Cortesias ativas</span>
          <strong>{courtesyQuantity}</strong>
        </article>
        <article className="summary-card">
          <span>Disponíveis</span>
          <strong>{availableQuantity}</strong>
        </article>
        <article className="summary-card summary-card--accent">
          <span>Receita ativa</span>
          <strong>{formatCurrency(state?.activeRevenueCents ?? 0)}</strong>
        </article>
      </div>

      {initialLoading ? <div className="route-state">Carregando ingressos…</div> : null}

      {!initialLoading && (state?.activeEventId === null || state === null) ? (
        <div className="inventory-warning">
          <TriangleAlert size={19} aria-hidden="true" />
          <span>Selecione um evento aberto antes de administrar ingressos.</span>
        </div>
      ) : null}

      {error === null ? null : <p className="form-error">{error}</p>}
      {message === null ? null : <p className="form-success">{message}</p>}

      {state?.activeEventId !== null && state !== null ? (
        <>
          <div className="ticket-admin-grid">
            <article className="panel">
              <TicketLotForm busy={busy} onSubmit={createLot} />
            </article>
            <article className="panel">
              <TicketSaleForm busy={busy} lots={activeLots} onSubmit={createSale} />
            </article>
          </div>

          <div className="ticket-lot-toolbar">
            <button
              aria-pressed={!showArchivedLots}
              className={!showArchivedLots ? 'button button--secondary' : 'button button--ghost'}
              onClick={() => {
                setShowArchivedLots(false);
              }}
              type="button"
            >
              <Ticket size={16} aria-hidden="true" />
              Lotes ativos ({activeLots.length})
            </button>
            <button
              aria-pressed={showArchivedLots}
              className={showArchivedLots ? 'button button--secondary' : 'button button--ghost'}
              onClick={() => {
                setShowArchivedLots(true);
              }}
              type="button"
            >
              <Archive size={16} aria-hidden="true" />
              Excluídos ({archivedLots.length})
            </button>
          </div>

          <div className="ticket-lot-list">
            {visibleLots.map((lot) => (
              <TicketLotCard
                busy={busy}
                key={lot.id}
                lot={lot}
                onDelete={deleteLot}
                onUpdate={updateLot}
              />
            ))}
          </div>

          <article className="panel ticket-history-panel">
            <div className="panel__heading">
              <Ticket size={20} aria-hidden="true" />
              <div>
                <h2>Vendas e cortesias</h2>
                <p>
                  Cancelar mantém o registro. Excluir remove o registro e aplica automaticamente o
                  estorno necessário antes da exclusão.
                </p>
              </div>
            </div>
            {loading && sales.length === 0 ? (
              <div className="route-state">Carregando ingressos…</div>
            ) : null}
            {!loading && sales.length === 0 ? (
              <div className="empty-state">
                <Ticket size={32} aria-hidden="true" />
                <h2>Nenhum ingresso registrado</h2>
                <p>Crie um lote e registre a primeira venda ou cortesia.</p>
              </div>
            ) : null}
            <div className="ticket-sale-list">
              {sales.map((sale) => (
                <TicketSaleCard
                  busy={busy}
                  key={sale.id}
                  onCancel={cancelSale}
                  onCancelCode={cancelCode}
                  onDeleteCode={deleteCode}
                  onDeleteSale={deleteSale}
                  sale={sale}
                />
              ))}
            </div>
          </article>
        </>
      ) : null}
    </section>
  );
}
