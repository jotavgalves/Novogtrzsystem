import { RotateCcw } from 'lucide-react';
import { useState } from 'react';

import type { Expense, PaymentMethod } from '@gtrz/contracts';
import { formatCurrency, parseCurrencyInput } from '@gtrz/domain';

import { EXPENSE_PAYMENT_LABELS } from './expense-ui';

interface ExpensePaymentsSectionProps {
  readonly expense: Expense;
  readonly busy: boolean;
  readonly onPay: (
    expenseId: string,
    amountCents: number,
    paymentMethod: PaymentMethod,
    note?: string,
  ) => Promise<void>;
  readonly onRefundPayment: (paymentId: string, reason: string) => Promise<void>;
}

export function ExpensePaymentsSection({
  expense,
  busy,
  onPay,
  onRefundPayment,
}: ExpensePaymentsSectionProps): React.JSX.Element {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [paymentNote, setPaymentNote] = useState('');
  const [refundReasons, setRefundReasons] = useState<Readonly<Record<string, string>>>({});
  const paymentAmountCents = parseCurrencyInput(paymentAmount);
  const canPay = expense.status !== 'cancelled' && expense.pendingCents > 0;

  return (
    <>
      {canPay ? (
        <form
          className="expense-payment-form"
          onSubmit={(event) => {
            event.preventDefault();
            const note = paymentNote.trim();

            if (paymentAmountCents <= 0 || paymentAmountCents > expense.pendingCents) {
              return;
            }

            void onPay(
              expense.id,
              paymentAmountCents,
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
              aria-invalid={paymentAmountCents > expense.pendingCents}
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
              {Object.entries(EXPENSE_PAYMENT_LABELS).map(([method, label]) => (
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
            className="button button--secondary"
            disabled={
              busy || paymentAmountCents <= 0 || paymentAmountCents > expense.pendingCents
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
                    {EXPENSE_PAYMENT_LABELS[payment.paymentMethod]} ·{' '}
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
    </>
  );
}
