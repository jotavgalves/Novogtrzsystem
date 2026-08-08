import { CreditCard, Plus, Split, Trash2, WalletCards } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { CloseOrderInput, Order, PaymentMethod } from '@gtrz/contracts';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from '@gtrz/domain';

import { type CheckoutMode, type PaymentDraft, validateCheckout } from './checkout-validation';
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

function newPayment(method: PaymentMethod = 'pix'): PaymentDraft {
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
  const [mode, setMode] = useState<CheckoutMode>('single');
  const [singleMethod, setSingleMethod] = useState<PaymentMethod>('cash');
  const [singleReceived, setSingleReceived] = useState('');
  const [mixedPayments, setMixedPayments] = useState<readonly PaymentDraft[]>([
    newPayment('cash'),
    newPayment('pix'),
  ]);
  const [voucherAmount, setVoucherAmount] = useState('');
  const allocation = order.voucherAllocation;
  const payments = useMemo<readonly PaymentDraft[]>(
    () =>
      mode === 'single'
        ? [
            {
              id: 'single-payment',
              method: singleMethod,
              amount: '',
              received: singleReceived,
            },
          ]
        : mixedPayments,
    [mixedPayments, mode, singleMethod, singleReceived],
  );
  const checkout = useMemo(
    () => validateCheckout({ order, discount, payments, voucherAmount, busy, mode }),
    [busy, discount, mode, order, payments, voucherAmount],
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

  const updateMixedPayment = (id: string, patch: Partial<PaymentDraft>): void => {
    setMixedPayments((current) =>
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
          <h3>Pagamento</h3>
          <p>
            {mode === 'single'
              ? 'Escolha a forma. O sistema aplica automaticamente o valor total restante.'
              : 'Distribua manualmente quanto deve ir para cada forma de pagamento.'}
          </p>
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
        {mode === 'mixed' ? (
          <small>
            Distribuído: {formatCurrency(checkout.informedCents)} · Restante:{' '}
            {formatCurrency(checkout.remainingCents)}
          </small>
        ) : (
          <small>O saldo restante será aplicado integralmente à forma escolhida.</small>
        )}
        {checkout.overpaidCents > 0 ? (
          <small className="checkout-warning">
            O rateio supera o total em {formatCurrency(checkout.overpaidCents)}.
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

      {mode === 'single' ? (
        <div className="payment-simple">
          <label className="form-field">
            <span>Forma de pagamento</span>
            <select
              disabled={busy}
              onChange={(event) => {
                setSingleMethod(event.target.value as PaymentMethod);
                setSingleReceived('');
              }}
              value={singleMethod}
            >
              {Object.entries(PAYMENT_LABELS).map(([method, label]) => (
                <option key={method} value={method}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {singleMethod === 'cash' ? (
            <label className="form-field cash-received-field">
              <span>Valor recebido em dinheiro · opcional</span>
              <input
                aria-invalid={checkout.cashInvalid}
                aria-label="Valor recebido em dinheiro"
                disabled={busy}
                inputMode="decimal"
                onChange={(event) => {
                  setSingleReceived(event.target.value);
                }}
                placeholder="Deixe vazio se recebeu o valor exato"
                value={singleReceived}
              />
              <small className={checkout.cashInvalid ? 'checkout-warning' : undefined}>
                {checkout.cashInvalid
                  ? `O valor recebido é menor que ${formatCurrency(checkout.cashAppliedCents)}.`
                  : checkout.totalChangeCents > 0
                    ? `Troco: ${formatCurrency(checkout.totalChangeCents)}`
                    : 'Se o cliente pagar o valor exato, não precisa preencher este campo.'}
              </small>
            </label>
          ) : (
            <div className="payment-simple__automatic">
              <CreditCard size={17} aria-hidden="true" />
              <span>
                <small>Valor aplicado automaticamente</small>
                <strong>
                  {formatCurrency(Math.max(checkout.totalCents - checkout.voucherCents, 0))}
                </strong>
              </span>
            </div>
          )}

          <button
            className="button button--secondary"
            disabled={busy}
            onClick={() => {
              setMode('mixed');
              setMixedPayments([
                newPayment(singleMethod),
                newPayment(singleMethod === 'cash' ? 'pix' : 'cash'),
              ]);
            }}
            type="button"
          >
            <Split size={16} aria-hidden="true" />
            Pagamento misto
          </button>
        </div>
      ) : (
        <div className="payment-mixed">
          <div className="payment-mixed__heading">
            <div>
              <strong>Pagamento misto</strong>
              <small>Informe quanto deve ir para cada forma.</small>
            </div>
            <button
              className="button button--ghost button--compact"
              disabled={busy}
              onClick={() => {
                setMode('single');
                setSingleReceived('');
              }}
              type="button"
            >
              Usar pagamento simples
            </button>
          </div>

          <div className="payment-list">
            {mixedPayments.map((payment, index) => {
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
                      updateMixedPayment(payment.id, {
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
                      updateMixedPayment(payment.id, { amount: event.target.value });
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
                          updateMixedPayment(payment.id, { received: event.target.value });
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
                    disabled={busy || mixedPayments.length === 1}
                    onClick={() => {
                      setMixedPayments((current) =>
                        current.filter((item) => item.id !== payment.id),
                      );
                    }}
                    type="button"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>

          {checkout.paymentConfigurationInvalid ? (
            <p className="form-error">Use no máximo uma linha de pagamento em dinheiro.</p>
          ) : null}
          {checkout.cashInvalid ? (
            <p className="form-error">
              O dinheiro recebido não pode ser menor que o valor aplicado.
            </p>
          ) : null}

          <button
            className="button button--secondary"
            disabled={busy}
            onClick={() => {
              setMixedPayments((current) => [...current, newPayment('pix')]);
            }}
            type="button"
          >
            <Plus size={16} aria-hidden="true" />
            Adicionar forma
          </button>
        </div>
      )}

      {checkout.totalChangeCents > 0 ? (
        <div className="checkout-change" role="status">
          <span>Troco a entregar</span>
          <strong>{formatCurrency(checkout.totalChangeCents)}</strong>
        </div>
      ) : null}

      <div className="checkout-form__actions checkout-form__actions--primary">
        <button className="button button--success" disabled={!checkout.canSubmit} type="submit">
          Concluir venda
        </button>
      </div>
    </form>
  );
}
