import { Banknote, Calculator, CreditCard, Split, X } from 'lucide-react';
import { useEffect, useState } from 'react';

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
  const [showCashReceived, setShowCashReceived] = useState(false);

  useEffect(() => {
    if (method !== 'cash') {
      setShowCashReceived(false);
    }
  }, [method]);

  return (
    <div className="payment-simple">
      <label className="form-field">
        <span>Forma de pagamento</span>
        <select
          disabled={busy}
          onChange={(event) => {
            const nextMethod = event.target.value as PaymentMethod;
            onMethodChange(nextMethod);
            setShowCashReceived(false);
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

      <div className="payment-simple__automatic payment-simple__automatic--primary">
        {method === 'cash' ? (
          <Banknote size={17} aria-hidden="true" />
        ) : (
          <CreditCard size={17} aria-hidden="true" />
        )}
        <span>
          <small>Valor assumido como recebido</small>
          <strong>{formatCurrency(appliedCents)}</strong>
        </span>
      </div>

      {method === 'cash' ? (
        showCashReceived ? (
          <div className="cash-received-box">
            <label className="form-field cash-received-field">
              <span>Quanto o cliente entregou?</span>
              <input
                aria-invalid={cashInvalid}
                aria-label="Valor recebido em dinheiro"
                disabled={busy}
                inputMode="decimal"
                onChange={(event) => {
                  onReceivedChange(event.target.value);
                }}
                placeholder={formatCurrency(appliedCents)}
                value={received}
              />
              <small className={cashInvalid ? 'checkout-warning' : undefined}>
                {cashInvalid
                  ? `O valor recebido é menor que ${formatCurrency(appliedCents)}.`
                  : changeCents > 0
                    ? `Troco: ${formatCurrency(changeCents)}`
                    : 'Use este campo apenas quando precisar calcular troco.'}
              </small>
            </label>
            <button
              aria-label="Fechar cálculo de troco"
              className="icon-button"
              disabled={busy}
              onClick={() => {
                setShowCashReceived(false);
                onReceivedChange('');
              }}
              type="button"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            className="button button--ghost payment-simple__change-button"
            disabled={busy}
            onClick={() => {
              setShowCashReceived(true);
            }}
            type="button"
          >
            <Calculator size={16} aria-hidden="true" />
            Calcular troco
          </button>
        )
      ) : null}

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