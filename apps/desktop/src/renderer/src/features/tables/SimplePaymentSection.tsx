import { CreditCard, Split } from 'lucide-react';

import type { PaymentMethod } from '@gtrz/contracts';
import { formatCurrency } from '@gtrz/domain';

import { PAYMENT_LABELS } from './checkout-payment-ui';

interface SimplePaymentSectionProps {
  readonly busy: boolean;
  readonly method: PaymentMethod;
  readonly received: string;
  readonly appliedCents: number;
  readonly changeCents: number;
  readonly cashInvalid: boolean;
  readonly onMethodChange: (method: PaymentMethod) => void;
  readonly onReceivedChange: (value: string) => void;
  readonly onUseMixed: () => void;
}

export function SimplePaymentSection({
  busy,
  method,
  received,
  appliedCents,
  changeCents,
  cashInvalid,
  onMethodChange,
  onReceivedChange,
  onUseMixed,
}: SimplePaymentSectionProps): React.JSX.Element {
  return (
    <div className="payment-simple">
      <label className="form-field">
        <span>Forma de pagamento</span>
        <select
          disabled={busy}
          onChange={(event) => {
            onMethodChange(event.target.value as PaymentMethod);
          }}
          value={method}
        >
          {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {method === 'cash' ? (
        <label className="form-field cash-received-field">
          <span>Valor recebido em dinheiro · opcional</span>
          <input
            aria-invalid={cashInvalid}
            aria-label="Valor recebido em dinheiro"
            disabled={busy}
            inputMode="decimal"
            onChange={(event) => {
              onReceivedChange(event.target.value);
            }}
            placeholder="Deixe vazio se recebeu o valor exato"
            value={received}
          />
          <small className={cashInvalid ? 'checkout-warning' : undefined}>
            {cashInvalid
              ? `O valor recebido é menor que ${formatCurrency(appliedCents)}.`
              : changeCents > 0
                ? `Troco: ${formatCurrency(changeCents)}`
                : 'Se o cliente pagar o valor exato, não precisa preencher este campo.'}
          </small>
        </label>
      ) : (
        <div className="payment-simple__automatic">
          <CreditCard size={17} aria-hidden="true" />
          <span>
            <small>Valor aplicado automaticamente</small>
            <strong>{formatCurrency(appliedCents)}</strong>
          </span>
        </div>
      )}

      <button
        className="button button--secondary"
        disabled={busy}
        onClick={onUseMixed}
        type="button"
      >
        <Split size={16} aria-hidden="true" />
        Pagamento misto
      </button>
    </div>
  );
}
