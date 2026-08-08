import { WalletCards } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { CloseOrderInput, Order, PaymentMethod } from '@gtrz/contracts';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from '@gtrz/domain';

import { createPaymentDraft } from './checkout-payment-ui';
import { type CheckoutMode, type PaymentDraft, validateCheckout } from './checkout-validation';
import { MixedPaymentSection } from './MixedPaymentSection';
import { SimplePaymentSection } from './SimplePaymentSection';
import { VoucherCheckout } from './VoucherCheckout';

interface CheckoutFormProps {
  readonly order: Order;
  readonly busy: boolean;
  readonly onBindVoucher: (code: string) => Promise<void>;
  readonly onUnbindVoucher: () => Promise<void>;
  readonly onClose: (input: Omit<CloseOrderInput, 'orderId'>) => Promise<void>;
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
    createPaymentDraft('cash'),
    createPaymentDraft('pix'),
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
  const amountAfterVoucherCents = Math.max(checkout.totalCents - checkout.voucherCents, 0);

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
        <SimplePaymentSection
          appliedCents={amountAfterVoucherCents}
          busy={busy}
          cashInvalid={checkout.cashInvalid}
          changeCents={checkout.totalChangeCents}
          method={singleMethod}
          onMethodChange={(method) => {
            setSingleMethod(method);
            setSingleReceived('');
          }}
          onReceivedChange={setSingleReceived}
          onUseMixed={() => {
            setMode('mixed');
            setMixedPayments([
              createPaymentDraft(singleMethod),
              createPaymentDraft(singleMethod === 'cash' ? 'pix' : 'cash'),
            ]);
          }}
          received={singleReceived}
        />
      ) : (
        <MixedPaymentSection
          busy={busy}
          cashInvalid={checkout.cashInvalid}
          onPaymentsChange={setMixedPayments}
          onUseSingle={() => {
            setMode('single');
            setSingleReceived('');
          }}
          paymentConfigurationInvalid={checkout.paymentConfigurationInvalid}
          payments={mixedPayments}
        />
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
