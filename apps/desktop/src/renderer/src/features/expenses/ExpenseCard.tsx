import { CreditCard, WalletCards } from 'lucide-react';

import type {
  Expense,
  ExpenseCancelPreview,
  PaymentMethod,
  UpdateExpenseInput,
} from '@gtrz/contracts';
import { formatCurrency } from '@gtrz/domain';

import { ExpenseCancellationSection } from './ExpenseCancellationSection';
import { ExpenseEditSection } from './ExpenseEditSection';
import { ExpensePaymentsSection } from './ExpensePaymentsSection';
import { EXPENSE_PAYMENT_LABELS, EXPENSE_STATUS_LABELS } from './expense-ui';

interface ExpenseCardProps {
  readonly expense: Expense;
  readonly busy: boolean;
  readonly onUpdate: (input: UpdateExpenseInput) => Promise<void>;
  readonly onPay: (
    expenseId: string,
    amountCents: number,
    paymentMethod: PaymentMethod,
    note?: string,
  ) => Promise<void>;
  readonly onRefundPayment: (paymentId: string, reason: string) => Promise<void>;
  readonly onPreviewCancel: (expenseId: string) => Promise<ExpenseCancelPreview>;
  readonly onCancel: (expenseId: string, reason: string) => Promise<void>;
}

export function ExpenseCard({
  expense,
  busy,
  onUpdate,
  onPay,
  onRefundPayment,
  onPreviewCancel,
  onCancel,
}: ExpenseCardProps): React.JSX.Element {
  return (
    <article className="expense-card">
      <header className="expense-card__header">
        <span>
          <strong>{expense.description}</strong>
          <small>{expense.category}</small>
        </span>
        <span
          className={
            expense.status === 'paid'
              ? 'status-badge status-badge--open'
              : 'status-badge status-badge--archived'
          }
        >
          {EXPENSE_STATUS_LABELS[expense.status]}
        </span>
      </header>

      <div className="expense-card__value">
        <strong>{formatCurrency(expense.totalCents)}</strong>
        <span>
          {expense.paymentMethod === 'cash' ? (
            <WalletCards size={15} aria-hidden="true" />
          ) : (
            <CreditCard size={15} aria-hidden="true" />
          )}
          {expense.paymentMethod === null
            ? 'Sem pagamento'
            : EXPENSE_PAYMENT_LABELS[expense.paymentMethod]}
        </span>
      </div>

      <div className="expense-card__ledger">
        <span>
          Pago <strong>{formatCurrency(expense.paidCents)}</strong>
        </span>
        <span>
          Pendente <strong>{formatCurrency(expense.pendingCents)}</strong>
        </span>
      </div>

      {expense.note === null ? null : <p>{expense.note}</p>}

      <ExpenseEditSection busy={busy} expense={expense} onUpdate={onUpdate} />
      <ExpensePaymentsSection
        busy={busy}
        expense={expense}
        onPay={onPay}
        onRefundPayment={onRefundPayment}
      />
      <ExpenseCancellationSection
        busy={busy}
        expense={expense}
        onCancel={onCancel}
        onPreviewCancel={onPreviewCancel}
      />
    </article>
  );
}
