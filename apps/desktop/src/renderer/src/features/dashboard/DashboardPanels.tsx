import { Activity, Ticket, WalletCards } from 'lucide-react';

import type { DashboardState } from '@gtrz/contracts';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value);
}

function clampPercent(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function SalesMethods({ state }: { readonly state: DashboardState }): React.JSX.Element {
  const methods = [
    ['Dinheiro', state.salesByMethod.cashCents],
    ['PIX', state.salesByMethod.pixCents],
    ['Crédito', state.salesByMethod.creditCardCents],
    ['Débito', state.salesByMethod.debitCardCents],
    ['Voucher', state.salesByMethod.voucherCents],
  ] as const;
  const totalCents = methods.reduce((total, [, value]) => total + value, 0);

  return (
    <article className="panel insight-panel">
      <div className="panel__heading">
        <WalletCards size={20} aria-hidden="true" />
        <div>
          <h2>Recebimentos</h2>
          <p>Participação de cada meio no valor recebido.</p>
        </div>
      </div>
      <div className="payment-share-list">
        {methods.map(([label, value]) => {
          const share = totalCents === 0 ? 0 : value / totalCents;

          return (
            <div className="payment-share" key={label}>
              <div className="payment-share__heading">
                <span>{label}</span>
                <strong>{formatMoney(value)}</strong>
              </div>
              <div
                aria-label={`${label}: ${formatPercent(share)}`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={Math.round(share * 100)}
                className="insight-progress"
                role="progressbar"
              >
                <span style={{ width: `${String(clampPercent(share) * 100)}%` }} />
              </div>
              <small>{formatPercent(share)} do total recebido</small>
            </div>
          );
        })}
      </div>
    </article>
  );
}

interface HealthItemProps {
  readonly label: string;
  readonly value: string | number;
  readonly detail: string;
  readonly status?: 'success' | 'warning' | 'neutral';
}

function HealthItem({
  label,
  value,
  detail,
  status = 'neutral',
}: HealthItemProps): React.JSX.Element {
  return (
    <div className={`insight-health insight-health--${status}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export function OperationalHealth({
  state,
}: {
  readonly state: DashboardState;
}): React.JSX.Element {
  const cashStatus =
    state.cashRegisterStatus === 'open'
      ? { value: 'Aberto', detail: 'Disponível para movimentações', status: 'success' as const }
      : state.cashRegisterStatus === 'closed'
        ? { value: 'Fechado', detail: 'Conciliação já concluída', status: 'neutral' as const }
        : {
            value: 'Não aberto',
            detail: 'Abra o caixa antes das vendas',
            status: 'warning' as const,
          };

  return (
    <article className="panel insight-panel">
      <div className="panel__heading">
        <Activity size={20} aria-hidden="true" />
        <div>
          <h2>Saúde operacional</h2>
          <p>Pendências e estados que influenciam o encerramento.</p>
        </div>
      </div>
      <div className="insight-health-grid">
        <HealthItem
          detail={
            state.orders.open === 0
              ? 'Nenhuma pendência de atendimento'
              : 'Precisam ser pagas ou canceladas'
          }
          label="Comandas abertas"
          status={state.orders.open === 0 ? 'success' : 'warning'}
          value={state.orders.open}
        />
        <HealthItem
          detail={
            state.inventory.lowStockProducts === 0
              ? 'Todos os produtos acima do limite'
              : 'Verifique reposição ou ajuste de saldo'
          }
          label="Estoque baixo"
          status={state.inventory.lowStockProducts === 0 ? 'success' : 'warning'}
          value={state.inventory.lowStockProducts}
        />
        <HealthItem
          detail={`${formatMoney(state.vouchers.outstandingBalanceCents)} ainda disponíveis`}
          label="Vouchers ativos"
          value={state.vouchers.active}
        />
        <HealthItem label="Caixa" {...cashStatus} />
      </div>
    </article>
  );
}

export function TicketCapacity({ state }: { readonly state: DashboardState }): React.JSX.Element {
  const used = state.tickets.sold + state.tickets.courtesy;
  const capacity = used + state.tickets.available;
  const occupancy = capacity === 0 ? 0 : used / capacity;

  return (
    <article className="panel ticket-capacity-panel">
      <div className="panel__heading">
        <Ticket size={20} aria-hidden="true" />
        <div>
          <h2>Ocupação dos lotes</h2>
          <p>Ingressos pagos e cortesias em relação à capacidade cadastrada.</p>
        </div>
      </div>
      <div className="ticket-capacity__numbers">
        <span>
          <small>Utilizados</small>
          <strong>{used}</strong>
        </span>
        <span>
          <small>Disponíveis</small>
          <strong>{state.tickets.available}</strong>
        </span>
        <span>
          <small>Ocupação</small>
          <strong>{formatPercent(occupancy)}</strong>
        </span>
      </div>
      <div
        aria-label={`Ocupação dos lotes: ${formatPercent(occupancy)}`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(occupancy * 100)}
        className="insight-progress insight-progress--large"
        role="progressbar"
      >
        <span style={{ width: `${String(clampPercent(occupancy) * 100)}%` }} />
      </div>
      <small className="ticket-capacity__note">
        {state.tickets.sold} pagos · {state.tickets.courtesy} cortesias · {capacity} de capacidade
        total
      </small>
    </article>
  );
}
