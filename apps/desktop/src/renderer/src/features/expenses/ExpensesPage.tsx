import { ReceiptText, RefreshCw, TriangleAlert } from 'lucide-react';

import { formatCurrency } from '@gtrz/domain';

import { ExpenseCard } from './ExpenseCard';
import { ExpenseForm } from './ExpenseForm';
import { useExpenses } from './useExpenses';

export function ExpensesPage(): React.JSX.Element {
  const {
    state,
    loading,
    busy,
    error,
    message,
    reload,
    createExpense,
    payExpense,
    refundExpensePayment,
    cancelExpense,
  } = useExpenses();
  const expenses = state?.expenses ?? [];
  const activeExpenses = expenses.filter((expense) => expense.status !== 'cancelled');
  const cancelledExpenses = expenses.filter((expense) => expense.status === 'cancelled');
  const totalCents = activeExpenses.reduce((total, expense) => total + expense.totalCents, 0);
  const paidCents = activeExpenses.reduce((total, expense) => total + expense.paidCents, 0);
  const pendingCents = activeExpenses.reduce((total, expense) => total + expense.pendingCents, 0);

  return (
    <section className="feature-page">
      <header className="feature-header">
        <div>
          <span className="eyebrow">Saídas efetivamente pagas</span>
          <h1>Despesas</h1>
          <p>Registre gastos do evento e mantenha cancelamentos preservados na auditoria.</p>
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
          <span>Obrigações ativas</span>
          <strong>{formatCurrency(totalCents)}</strong>
        </article>
        <article className="summary-card">
          <span>Total pago</span>
          <strong>{formatCurrency(paidCents)}</strong>
        </article>
        <article className="summary-card">
          <span>Saldo pendente</span>
          <strong>{formatCurrency(pendingCents)}</strong>
        </article>
        <article className="summary-card">
          <span>Cancelados</span>
          <strong>{cancelledExpenses.length}</strong>
        </article>
      </div>

      {state?.activeEventId === null || state === null ? (
        <div className="inventory-warning">
          <TriangleAlert size={19} aria-hidden="true" />
          <span>Selecione um evento aberto antes de registrar despesas.</span>
        </div>
      ) : null}

      {error === null ? null : <p className="form-error">{error}</p>}
      {message === null ? null : <p className="form-success">{message}</p>}

      {state?.activeEventId !== null && state !== null ? (
        <div className="expense-layout">
          <article className="panel">
            <ExpenseForm busy={busy} onSubmit={createExpense} />
          </article>
          <div className="expense-list" aria-live="polite">
            {loading ? <div className="route-state">Carregando despesas…</div> : null}
            {!loading && expenses.length === 0 ? (
              <div className="empty-state">
                <ReceiptText size={32} aria-hidden="true" />
                <h2>Nenhuma despesa registrada</h2>
                <p>Cadastre a primeira saída financeira do evento.</p>
              </div>
            ) : null}
            {expenses.map((expense) => (
              <ExpenseCard
                busy={busy}
                expense={expense}
                key={expense.id}
                onCancel={cancelExpense}
                onPay={payExpense}
                onRefundPayment={refundExpensePayment}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
