import {
  Activity,
  Banknote,
  Boxes,
  CircleDollarSign,
  RefreshCw,
  Ticket,
  TriangleAlert,
  TrendingUp,
} from 'lucide-react';

import gtrzSymbol from '../../assets/brand/gtrz-symbol.svg';
import { describeAuditAction, describeEntityType } from '../../shared/insights/audit-labels';
import { OperationalHealth, SalesMethods, TicketCapacity } from './DashboardPanels';
import { useDashboard } from './useDashboard';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(timestamp);
}

function formatMargin(value: number | null): string {
  if (value === null) {
    return 'Sem receita';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value);
}

export function DashboardPage(): React.JSX.Element {
  const { state, loading, error, reload } = useDashboard();
  const resultMargin =
    state === null || state.grossSalesCents === 0
      ? null
      : state.projectedResultCents / state.grossSalesCents;
  const hasOperationalWarning =
    state !== null && (state.orders.open > 0 || state.inventory.lowStockProducts > 0);

  return (
    <section className="feature-page">
      <header className="feature-header">
        <div>
          <span className="eyebrow">Consolidação em tempo real</span>
          <h1>Visão geral</h1>
          <p>Vendas, despesas, caixa, estoque, ingressos e vouchers do evento ativo.</p>
        </div>
        <button
          className="button button--secondary"
          disabled={loading}
          onClick={() => {
            void reload();
          }}
          type="button"
        >
          <RefreshCw size={17} aria-hidden="true" />
          Atualizar
        </button>
      </header>

      {error === null ? null : <p className="form-error">{error}</p>}
      {loading && state === null ? (
        <div className="route-state">Carregando indicadores…</div>
      ) : null}

      {!loading && state?.activeEvent === null ? (
        <div className="empty-state">
          <CircleDollarSign size={34} aria-hidden="true" />
          <h2>Nenhum evento em operação</h2>
          <p>Selecione um evento aberto para acompanhar os indicadores consolidados.</p>
        </div>
      ) : null}

      {state?.activeEvent === null || state === null ? null : (
        <>
          <article className="dashboard-event-banner">
            <img alt="" aria-hidden="true" src={gtrzSymbol} />
            <div className="dashboard-event-banner__identity">
              <span>Evento em operação</span>
              <strong>{state.activeEvent.name}</strong>
              <small>Início: {formatDate(state.activeEvent.startsAt)}</small>
            </div>
            <div className="dashboard-event-banner__margin">
              <span>Margem projetada</span>
              <strong>{formatMargin(resultMargin)}</strong>
            </div>
          </article>

          <div
            className={
              hasOperationalWarning
                ? 'dashboard-alert dashboard-alert--warning'
                : 'dashboard-alert dashboard-alert--success'
            }
          >
            {hasOperationalWarning ? (
              <TriangleAlert size={18} aria-hidden="true" />
            ) : (
              <Activity size={18} aria-hidden="true" />
            )}
            <span>
              {hasOperationalWarning
                ? 'Há pendências operacionais. Verifique comandas abertas e produtos com estoque baixo.'
                : 'Operação sem pendências críticas de comandas ou estoque baixo.'}
            </span>
          </div>

          <div className="summary-grid">
            <article className="summary-card summary-card--accent">
              <CircleDollarSign className="summary-card__icon" size={20} aria-hidden="true" />
              <span>Faturamento</span>
              <strong>{formatMoney(state.grossSalesCents)}</strong>
              <small>{state.orders.paid} vendas concluídas</small>
            </article>
            <article className="summary-card">
              <Banknote className="summary-card__icon" size={20} aria-hidden="true" />
              <span>Despesas ativas</span>
              <strong>{formatMoney(state.activeExpensesCents)}</strong>
              <small>Valores não cancelados</small>
            </article>
            <article
              className={
                state.projectedResultCents < 0
                  ? 'summary-card summary-card--danger'
                  : 'summary-card'
              }
            >
              <TrendingUp className="summary-card__icon" size={20} aria-hidden="true" />
              <span>Resultado projetado</span>
              <strong>{formatMoney(state.projectedResultCents)}</strong>
              <small>Receita menos despesas</small>
            </article>
            <article className="summary-card">
              <Banknote className="summary-card__icon" size={20} aria-hidden="true" />
              <span>Caixa físico esperado</span>
              <strong>{formatMoney(state.expectedCashCents)}</strong>
              <small>Dinheiro após movimentações</small>
            </article>
          </div>

          <div className="insight-grid">
            <SalesMethods state={state} />
            <OperationalHealth state={state} />
          </div>

          <div className="insight-kpi-grid">
            <article className="insight-kpi">
              <Ticket size={19} aria-hidden="true" />
              <span>Ingressos pagos</span>
              <strong>{state.tickets.sold}</strong>
              <small>{formatMoney(state.tickets.revenueCents)} em receita</small>
            </article>
            <article className="insight-kpi">
              <Boxes size={19} aria-hidden="true" />
              <span>Estoque do evento</span>
              <strong>{state.inventory.units} un.</strong>
              <small>{formatMoney(state.inventory.stockCostCents)} em custo</small>
            </article>
            <article className="insight-kpi">
              <Banknote size={19} aria-hidden="true" />
              <span>Saldo em vouchers</span>
              <strong>{formatMoney(state.vouchers.outstandingBalanceCents)}</strong>
              <small>{state.vouchers.active} vouchers ativos</small>
            </article>
            <article className="insight-kpi">
              <TriangleAlert size={19} aria-hidden="true" />
              <span>Cancelamentos</span>
              <strong>{state.orders.cancelled}</strong>
              <small>Comandas canceladas ou estornadas</small>
            </article>
          </div>

          <TicketCapacity state={state} />

          <article className="panel insight-panel">
            <div className="panel__heading">
              <Activity size={20} aria-hidden="true" />
              <div>
                <h2>Atividade recente</h2>
                <p>Últimas operações registradas na auditoria do evento.</p>
              </div>
            </div>
            <div className="activity-list">
              {state.recentActivity.length === 0 ? (
                <p className="inventory-helper">Nenhuma atividade registrada.</p>
              ) : (
                state.recentActivity.map((record) => (
                  <div className="activity-row" key={record.id}>
                    <div>
                      <strong>{describeAuditAction(record.action)}</strong>
                      <span>{describeEntityType(record.entityType)}</span>
                    </div>
                    <time>{formatDate(record.createdAt)}</time>
                  </div>
                ))
              )}
            </div>
          </article>
        </>
      )}
    </section>
  );
}
