import { Boxes, ReceiptText, RefreshCw, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { ExpenseStatus } from '@gtrz/contracts';
import { formatCurrency } from '@gtrz/domain';

import { ExpenseCard } from './ExpenseCard';
import { ExpenseForm } from './ExpenseForm';
import { useExpenses } from './useExpenses';

type ExpenseFilter = 'all' | ExpenseStatus;

export function ExpensesPage(): React.JSX.Element {
  const {
    state,
    loading,
    busy,
    error,
    message,
    reload,
    createExpense,
    updateExpense,
    payExpense,
    refundExpensePayment,
    previewCancelExpense,
    cancelExpense,
  } = useExpenses();
  const [filter, setFilter] = useState<ExpenseFilter>('all');
  const expenses = state?.expenses ?? [];
  const activeExpenses = expenses.filter((expense) => expense.status !== 'cancelled');
  const cancelledExpenses = expenses.filter((expense) => expense.status === 'cancelled');
  const manualExpenseCents = state?.manualExpenseCents ?? 0;
  const inventoryCostCents = state?.inventoryCostCents ?? 0;
  const totalExpenseCents = state?.totalExpenseCents ?? 0;
  const paidCents = activeExpenses.reduce((total, expense) => total + expense.paidCents, 0);
  const pendingCents = activeExpenses.reduce((total, expense) => total + expense.pendingCents, 0);
  const initialLoading = loading && state === null;
  const filteredExpenses = useMemo(
    () => (filter === 'all' ? expenses : expenses.filter((expense) => expense.status === filter)),
    [expenses, filter],
  );
  const statusCount = (status: ExpenseStatus): number =>
    expenses.filter((expense) => expense.status === status).length;

  return (
    <section className="feature-page">
      <header className="feature-header">
        <div>
          <span className="eyebrow">Obrigações e pagamentos do evento</span>
          <h1>Despesas</h1>
          <p>
            Compras de estoque entram automaticamente no custo do evento; as demais obrigações são
            controladas aqui com pagamentos parciais e cancelamentos auditáveis.
          </p>
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
        <article className="summary-card summary-card--accent">
          <span>Despesas totais</span>
          <strong>{formatCurrency(totalExpenseCents)}</strong>
          <small>Manuais + compras de estoque</small>
        </article>
        <article className="summary-card">
          <span>Custo de estoque</span>
          <strong>{formatCurrency(inventoryCostCents)}</strong>
          <small>Entradas registradas como Compra</small>
        </article>
        <article className="summary-card">
          <span>Despesas manuais</span>
          <strong>{formatCurrency(manualExpenseCents)}</strong>
          <small>{formatCurrency(paidCents)} já pago</small>
        </article>
        <article className="summary-card">
          <span>Saldo manual pendente</span>
          <strong>{formatCurrency(pendingCents)}</strong>
          <small>{cancelledExpenses.length} cancelada(s)</small>
        </article>
      </div>

      {initialLoading ? <div className="route-state">Carregando despesas…</div> : null}

      {!initialLoading && (state?.activeEventId === null || state === null) ? (
        <div className="inventory-warning">
          <TriangleAlert size={19} aria-hidden="true" />
          <span>Selecione um evento aberto antes de registrar despesas.</span>
        </div>
      ) : null}

      {state?.activeEventId !== null && state !== null ? (
        <div className="inventory-expense-notice">
          <Boxes size={20} aria-hidden="true" />
          <div>
            <strong>Custo de estoque contabilizado automaticamente</strong>
            <span>
              Cada entrada de estoque do tipo Compra compõe as despesas do evento. Não cadastre a
              mesma compra novamente como despesa manual para evitar duplicidade.
            </span>
          </div>
          <strong>{formatCurrency(inventoryCostCents)}</strong>
        </div>
      ) : null}

      {error === null ? null : <p className="form-error">{error}</p>}
      {message === null ? null : <p className="form-success">{message}</p>}

      {state?.activeEventId !== null && state !== null ? (
        <div className="expense-layout">
          <article className="panel">
            <ExpenseForm busy={busy} onSubmit={createExpense} />
          </article>
          <div className="expense-list-column">
            <div className="expense-status-filters" aria-label="Filtrar despesas por status">
              <button
                aria-pressed={filter === 'all'}
                className={
                  filter === 'all'
                    ? 'expense-filter expense-filter--all is-active'
                    : 'expense-filter expense-filter--all'
                }
                onClick={() => setFilter('all')}
                type="button"
              >
                Todas <strong>{expenses.length}</strong>
              </button>
              <button
                aria-pressed={filter === 'open'}
                className={
                  filter === 'open'
                    ? 'expense-filter expense-filter--open is-active'
                    : 'expense-filter expense-filter--open'
                }
                onClick={() => setFilter('open')}
                type="button"
              >
                Em aberto <strong>{statusCount('open')}</strong>
              </button>
              <button
                aria-pressed={filter === 'partial'}
                className={
                  filter === 'partial'
                    ? 'expense-filter expense-filter--partial is-active'
                    : 'expense-filter expense-filter--partial'
                }
                onClick={() => setFilter('partial')}
                type="button"
              >
                Parcial <strong>{statusCount('partial')}</strong>
              </button>
              <button
                aria-pressed={filter === 'paid'}
                className={
                  filter === 'paid'
                    ? 'expense-filter expense-filter--paid is-active'
                    : 'expense-filter expense-filter--paid'
                }
                onClick={() => setFilter('paid')}
                type="button"
              >
                Pago <strong>{statusCount('paid')}</strong>
              </button>
              <button
                aria-pressed={filter === 'cancelled'}
                className={
                  filter === 'cancelled'
                    ? 'expense-filter expense-filter--cancelled is-active'
                    : 'expense-filter expense-filter--cancelled'
                }
                onClick={() => setFilter('cancelled')}
                type="button"
              >
                Canceladas <strong>{statusCount('cancelled')}</strong>
              </button>
            </div>

            <div className="expense-list" aria-live="polite">
              {loading && expenses.length === 0 ? (
                <div className="route-state">Carregando despesas…</div>
              ) : null}
              {!loading && expenses.length === 0 ? (
                <div className="empty-state">
                  <ReceiptText size={32} aria-hidden="true" />
                  <h2>Nenhuma despesa manual registrada</h2>
                  <p>Compras de estoque continuam sendo contabilizadas automaticamente acima.</p>
                </div>
              ) : null}
              {!loading && expenses.length > 0 && filteredExpenses.length === 0 ? (
                <div className="empty-state">
                  <ReceiptText size={28} aria-hidden="true" />
                  <h2>Nenhuma despesa neste status</h2>
                  <p>Selecione outro filtro para visualizar os demais registros.</p>
                </div>
              ) : null}
              {filteredExpenses.map((expense) => (
                <ExpenseCard
                  busy={busy}
                  expense={expense}
                  key={expense.id}
                  onCancel={cancelExpense}
                  onPay={payExpense}
                  onPreviewCancel={previewCancelExpense}
                  onRefundPayment={refundExpensePayment}
                  onUpdate={updateExpense}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
