import { Ban, CreditCard, RotateCcw, WalletCards } from 'lucide-react';
import { useState } from 'react';

import type { Expense, PaymentMethod } from '@gtrz/contracts';
import { formatCurrency, parseCurrencyInput } from '@gtrz/domain';

interface ExpenseCardProps {
  readonly expense: Expense;
  readonly busy: boolean;
  readonly onPay: (
    expenseId: string,
    amountCents: number,
    paymentMethod: PaymentMethod,
    note?: string,
  ) => Promise<void>;
  readonly onRefundPayment: (paymentId: string, reason: string) => Promise<void>;
  readonly onCancel: (expenseId: string, reason: string) => Promise<void>;
}

const PAYMENT_LABELS = {
  cash: 'Dinheiro',
  pix: 'PIX',
  'credit-card': 'Crédito',
  'debit-card': 'Débito',
} as const satisfies Readonly<Record<PaymentMethod, string>>;

const STATUS_LABELS = {
  open: 'Aberta',
  partial: 'Parcial',
  paid: 'Paga',
  cancelled: 'Cancelada',
} as const;

export function ExpenseCard({
  expense,
  busy,
  onPay,
  onRefundPayment,
  onCancel,
}: ExpenseCardProps): React.JSX.Element {
  const [reason, setReason] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [paymentNote, setPaymentNote] = useState('');
  const [refundReasons, setRefundReasons] = useState<Readonly<Record<string, string>>>({});
  const canPay = expense.status !== 'cancelled' && expense.pendingCents > 0;

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
          {STATUS_LABELS[expense.status]}
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
          {expense.paymentMethod === null ? 'Sem pagamento' : PAYMENT_LABELS[expense.paymentMethod]}
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

      {canPay ? (
        <form
          className="expense-payment-form"
          onSubmit={(event) => {
            event.preventDefault();
            const amountCents = parseCurrencyInput(paymentAmount);
            const note = paymentNote.trim();

            if (amountCents <= 0 || amountCents > expense.pendingCents) {
              return;
            }

            void onPay(
              expense.id,
              amountCents,
              paymentMethod,
              note.length === 0 ? undefined : note,
            ).then(() => {
              setPaymentAmount('');
              setPaymentNote('');
            });
          }}
        >
          <label className="form-field">
            <span>Pagar parcela</span>
            <input
              aria-invalid={parseCurrencyInput(paymentAmount) > expense.pendingCents}
              disabled={busy}
              inputMode="decimal"
              onChange={(event) => {
                setPaymentAmount(event.target.value);
              }}
              placeholder="0,00"
              value={paymentAmount}
            />
          </label>
          <label className="form-field">
            <span>Forma</span>
            <select
              disabled={busy}
              onChange={(event) => {
                setPaymentMethod(event.target.value as PaymentMethod);
              }}
              value={paymentMethod}
            >
              {Object.entries(PAYMENT_LABELS).map(([method, label]) => (
                <option key={method} value={method}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Nota</span>
            <input
              disabled={busy}
              maxLength={240}
              onChange={(event) => {
                setPaymentNote(event.target.value);
              }}
              placeholder="Opcional"
              value={paymentNote}
            />
          </label>
          <button
            className="button button--secondary button--compact"
            disabled={
              busy ||
              parseCurrencyInput(paymentAmount) <= 0 ||
              parseCurrencyInput(paymentAmount) > expense.pendingCents
            }
            type="submit"
          >
            Registrar pagamento
          </button>
        </form>
      ) : null}

      {expense.payments.length > 0 ? (
        <div className="expense-payment-list">
          {expense.payments.map((payment) => {
            const refundReason = refundReasons[payment.id] ?? '';
            return (
              <div className="expense-payment-row" key={payment.id}>
                <span>
                  <strong>{formatCurrency(payment.amountCents)}</strong>
                  <small>
                    {PAYMENT_LABELS[payment.paymentMethod]} ·{' '}
                    {payment.status === 'active' ? 'ativa' : 'estornada'}
                  </small>
                </span>
                {payment.status === 'active' && expense.status !== 'cancelled' ? (
                  <>
                    <input
                      aria-label="Motivo do estorno da parcela"
                      disabled={busy}
                      maxLength={240}
                      onChange={(event) => {
                        setRefundReasons((current) => ({
                          ...current,
                          [payment.id]: event.target.value,
                        }));
                      }}
                      placeholder="Motivo do estorno"
                      value={refundReason}
                    />
                    <button
                      className="button button--ghost button--compact"
                      disabled={busy || refundReason.trim().length < 3}
                      onClick={() => {
                        void onRefundPayment(payment.id, refundReason.trim()).then(() => {
                          setRefundReasons((current) => ({ ...current, [payment.id]: '' }));
                        });
                      }}
                      type="button"
                    >
                      <RotateCcw size={15} aria-hidden="true" />
                      Estornar
                    </button>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {expense.status !== 'cancelled' ? (
        <form
          className="expense-cancel-form"
          onSubmit={(event) => {
            event.preventDefault();
            const normalizedReason = reason.trim();

            if (normalizedReason.length < 3) {
              return;
            }

            void onCancel(expense.id, normalizedReason).then(() => {
              setReason('');
            });
          }}
        >
          <label className="form-field">
            <span>Motivo do cancelamento</span>
            <input
              disabled={busy}
              maxLength={240}
              onChange={(event) => {
                setReason(event.target.value);
              }}
              placeholder="Ex.: lançamento duplicado"
              value={reason}
            />
          </label>
          <button
            className="button button--ghost button--compact"
            disabled={busy || reason.trim().length < 3}
            type="submit"
          >
            <Ban size={15} aria-hidden="true" />
            Cancelar despesa
          </button>
        </form>
      ) : null}
    </article>
  );
}
