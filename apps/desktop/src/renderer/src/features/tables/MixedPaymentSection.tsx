import { CreditCard, Plus, Trash2 } from 'lucide-react';

import type { PaymentMethod } from '@gtrz/contracts';
import { formatCurrency, parseCurrencyInput } from '@gtrz/domain';

import { createPaymentDraft, PAYMENT_LABELS } from './checkout-payment-ui';
import type { PaymentDraft } from './checkout-validation';

interface MixedPaymentSectionProps {
  readonly busy: boolean;
  readonly payments: readonly PaymentDraft[];
  readonly cashInvalid: boolean;
  readonly paymentConfigurationInvalid: boolean;
  readonly onPaymentsChange: (payments: readonly PaymentDraft[]) => void;
  readonly onUseSingle: () => void;
}

export function MixedPaymentSection({
  busy,
  payments,
  cashInvalid,
  paymentConfigurationInvalid,
  onPaymentsChange,
  onUseSingle,
}: MixedPaymentSectionProps): React.JSX.Element {
  const updatePayment = (id: string, patch: Partial<PaymentDraft>): void => {
    onPaymentsChange(
      payments.map((payment) => (payment.id === id ? { ...payment, ...patch } : payment)),
    );
  };

  return (
    <div className="payment-mixed">
      <div className="payment-mixed__heading">
        <div>
          <strong>Pagamento misto</strong>
          <small>Informe quanto deve ir para cada forma.</small>
        </div>
        <button
          className="button button--ghost button--compact"
          disabled={busy}
          onClick={onUseSingle}
          type="button"
        >
          Usar pagamento simples
        </button>
      </div>

      <div className="payment-list">
        {payments.map((payment, index) => {
          const receivedCents = parseCurrencyInput(payment.received);
          const appliedCents = parseCurrencyInput(payment.amount);
          const receivedIsInsufficient =
            payment.method === 'cash' && receivedCents > 0 && receivedCents < appliedCents;

          return (
            <div className="payment-row" key={payment.id}>
              <select
                aria-label={`Forma de pagamento ${String(index + 1)}`}
                disabled={busy}
                onChange={(event) => {
                  updatePayment(payment.id, {
                    method: event.target.value as PaymentMethod,
                    received: '',
                  });
                }}
                value={payment.method}
              >
                {Object.entries(PAYMENT_LABELS).map(([method, label]) => (
                  <option key={method} value={method}>
                    {label}
                  </option>
                ))}
              </select>

              <input
                aria-label={`Valor do pagamento ${String(index + 1)}`}
                disabled={busy}
                inputMode="decimal"
                onChange={(event) => {
                  updatePayment(payment.id, { amount: event.target.value });
                }}
                placeholder="Valor aplicado"
                value={payment.amount}
              />

              {payment.method === 'cash' ? (
                <div className="cash-received-field">
                  <input
                    aria-invalid={receivedIsInsufficient}
                    aria-label={`Valor recebido ${String(index + 1)}`}
                    disabled={busy}
                    inputMode="decimal"
                    onChange={(event) => {
                      updatePayment(payment.id, { received: event.target.value });
                    }}
                    placeholder="Recebido · opcional"
                    value={payment.received}
                  />
                  <small className={receivedIsInsufficient ? 'checkout-warning' : undefined}>
                    {receivedIsInsufficient
                      ? `Faltam ${formatCurrency(appliedCents - receivedCents)}`
                      : receivedCents > appliedCents
                        ? `Troco: ${formatCurrency(receivedCents - appliedCents)}`
                        : 'Valor exato se ficar vazio'}
                  </small>
                </div>
              ) : (
                <span className="payment-row__digital">
                  <CreditCard size={16} aria-hidden="true" />
                  Sem troco
                </span>
              )}

              <button
                aria-label={`Remover pagamento ${String(index + 1)}`}
                className="icon-button"
                disabled={busy || payments.length === 1}
                onClick={() => {
                  onPaymentsChange(payments.filter((item) => item.id !== payment.id));
                }}
                type="button"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>

      {paymentConfigurationInvalid ? (
        <p className="form-error">Use no máximo uma linha de pagamento em dinheiro.</p>
      ) : null}
      {cashInvalid ? (
        <p className="form-error">O dinheiro recebido não pode ser menor que o valor aplicado.</p>
      ) : null}

      <button
        className="button button--secondary"
        disabled={busy}
        onClick={() => {
          onPaymentsChange([...payments, createPaymentDraft('pix')]);
        }}
        type="button"
      >
        <Plus size={16} aria-hidden="true" />
        Adicionar forma
      </button>
    </div>
  );
}
