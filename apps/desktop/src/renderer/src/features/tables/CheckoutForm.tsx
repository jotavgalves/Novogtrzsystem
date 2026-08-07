import { CreditCard, Plus, Trash2, WalletCards } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { CloseOrderInput, Order, PaymentMethod } from '@gtrz/contracts';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from '@gtrz/domain';

import { type PaymentDraft, validateCheckout } from './checkout-validation';
import { VoucherCheckout } from './VoucherCheckout';

interface CheckoutFormProps {
  readonly order: Order;
  readonly busy: boolean;
  readonly onBindVoucher: (code: string) => Promise<void>;
  readonly onUnbindVoucher: () => Promise<void>;
  readonly onClose: (input: Omit<CloseOrderInput, 'orderId'>) => Promise<void>;
}

const PAYMENT_LABELS: Readonly<Record<PaymentMethod, string>> = {
  cash: 'Dinheiro',
  pix: 'PIX',
  'credit-card': 'Crédito',
  'debit-card': 'Débito',
};

function newPayment(method: PaymentMethod = 'cash'): PaymentDraft {
  return {
    id: `${String(Date.now())}-${Math.random().toString(16).slice(2)}`,
    method,
    amount: '',
    received: '',
  };
}

export function CheckoutForm({
  order,
  busy,
  onBindVoucher,
  onUnbindVoucher,
  onClose,
}: CheckoutFormProps): React.JSX.Element {
  const [discount, setDiscount] = useState('');
  const [payments, setPayments] = useState<readonly PaymentDraft[]>([newPayment()]);
  const [voucherAmount, setVoucherAmount] = useState('');
  const allocation = order.voucherAllocation;
  const checkout = useMemo(
    () => validateCheckout({ order, discount, payments, voucherAmount, busy }),
    [busy, discount, order, payments, voucherAmount],
  );

  useEffect(() => {
    if (allocation === null) {
      setVoucherAmount('');
      return;
    }

    setVoucherAmount((current) => {
      const currentCents = parseCurrencyInput(current);
      const maximumCents = Math.min(allocation.remainingBalanceCents, checkout.totalCents);

      if (currentCents > 0 && currentCents <= maximumCents) {
        return current;
      }

      return maximumCents > 0 ? formatCurrencyInput(maximumCents) : '';
    });
  }, [allocation, checkout.totalCents]);

  const updatePayment = (id: string, patch: Partial<PaymentDraft>): void => {
    setPayments((current) =>
      current.map((payment) => (payment.id === id ? { ...payment, ...patch } : payment)),
    );
  };

  return (
    <form
      className="checkout-form"
      onSubmit={(event) => {
        event.preventDefault();

        if (!checkout.canSubmit) {
          return;
        }

        void onClose({
          discountCents: checkout.discountCents,
          payments: checkout.normalizedPayments,
          voucherUses: checkout.voucherUses,
        });
      }}
    >
      <div className="checkout-form__heading">
        <WalletCards size={19} aria-hidden="true" />
        <div>
          <h3>Fechar comanda</h3>
          <p>Combine voucher, dinheiro, PIX, crédito ou débito.</p>
        </div>
      </div>

      <label className="form-field">
        <span>Desconto em reais</span>
        <input
          aria-invalid={checkout.discountInvalid}
          disabled={busy}
          inputMode="decimal"
          onChange={(event) => {
            setDiscount(event.target.value);
          }}
          placeholder="0,00"
          value={discount}
        />
        {checkout.discountInvalid ? <small>O desconto não pode superar o subtotal.</small> : null}
      </label>

      <div className="checkout-total">
        <span>Total a receber</span>
        <strong>{formatCurrency(checkout.totalCents)}</strong>
        <small>
          Informado: {formatCurrency(checkout.informedCents)} · Restante:{' '}
          {formatCurrency(checkout.remainingCents)}
        </small>
        {checkout.overpaidCents > 0 ? (
          <small className="checkout-warning">
            O valor informado supera o total em {formatCurrency(checkout.overpaidCents)}.
          </small>
        ) : null}
      </div>

      <VoucherCheckout
        allocation={allocation}
        busy={busy}
        invalid={checkout.voucherInvalid}
        onBind={onBindVoucher}
        onUnbind={onUnbindVoucher}
        onValueChange={setVoucherAmount}
        orderId={order.id}
        servicePointId={order.servicePointId}
        value={voucherAmount}
        valueCents={checkout.voucherCents}
      />

      <div className="payment-list">
        {payments.map((payment, index) => {
          const amountCents = parseCurrencyInput(payment.amount);
          const receivedCents = parseCurrencyInput(payment.received);
          const changeCents = Math.max(receivedCents - amountCents, 0);
          const receivedIsInsufficient =
            payment.method === 'cash' && receivedCents > 0 && receivedCents < amountCents;

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
                    placeholder="Valor recebido"
                    value={payment.received}
                  />
                  <small className={receivedIsInsufficient ? 'checkout-warning' : undefined}>
                    {receivedIsInsufficient
                      ? `Faltam ${formatCurrency(amountCents - receivedCents)}`
                      : `Troco: ${formatCurrency(changeCents)}`}
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
                  setPayments((current) => current.filter((item) => item.id !== payment.id));
                }}
                type="button"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>

      {checkout.totalChangeCents > 0 ? (
        <div className="checkout-change" role="status">
          <span>Troco a entregar</span>
          <strong>{formatCurrency(checkout.totalChangeCents)}</strong>
        </div>
      ) : null}

      <div className="checkout-form__actions">
        <button
          className="button button--secondary"
          disabled={busy}
          onClick={() => {
            setPayments((current) => [...current, newPayment('pix')]);
          }}
          type="button"
        >
          <Plus size={16} aria-hidden="true" />
          Adicionar pagamento
        </button>
        <button className="button" disabled={!checkout.canSubmit} type="submit">
          Concluir venda
        </button>
      </div>
    </form>
  );
}
