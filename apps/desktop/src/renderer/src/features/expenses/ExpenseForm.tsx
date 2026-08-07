import { ReceiptText } from 'lucide-react';
import { useState } from 'react';

import type { CreateExpenseInput, PaymentMethod } from '@gtrz/contracts';
import { parseCurrencyInput } from '@gtrz/domain';

interface ExpenseFormProps {
  readonly busy: boolean;
  readonly onSubmit: (input: CreateExpenseInput) => Promise<void>;
}

const PAYMENT_LABELS: Readonly<Record<PaymentMethod, string>> = {
  cash: 'Dinheiro',
  pix: 'PIX',
  'credit-card': 'Crédito',
  'debit-card': 'Débito',
};

export function ExpenseForm({ busy, onSubmit }: ExpenseFormProps): React.JSX.Element {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [initialPayment, setInitialPayment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [note, setNote] = useState('');

  return (
    <form
      className="expense-form"
      onSubmit={(event) => {
        event.preventDefault();
        const normalizedNote = note.trim();
        const initialPaymentCents = parseCurrencyInput(initialPayment);
        const input =
          normalizedNote.length === 0
            ? {
                category: category.trim(),
                description: description.trim(),
                amountCents: parseCurrencyInput(amount),
                initialPaymentCents,
                paymentMethod,
              }
            : {
                category: category.trim(),
                description: description.trim(),
                amountCents: parseCurrencyInput(amount),
                initialPaymentCents,
                paymentMethod,
                note: normalizedNote,
              };
        void onSubmit(input).then(() => {
          setDescription('');
          setAmount('');
          setInitialPayment('');
          setNote('');
        });
      }}
    >
      <div className="panel__heading">
        <ReceiptText size={20} aria-hidden="true" />
        <div>
          <h2>Registrar despesa</h2>
          <p>Cadastre obrigações abertas, parciais ou pagas pelo evento.</p>
        </div>
      </div>
      <label className="form-field">
        <span>Categoria</span>
        <input
          disabled={busy}
          maxLength={80}
          onChange={(event) => {
            setCategory(event.target.value);
          }}
          placeholder="Ex.: Estrutura"
          required
          value={category}
        />
      </label>
      <label className="form-field">
        <span>Descrição</span>
        <input
          disabled={busy}
          maxLength={160}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
          placeholder="Ex.: Locação de gerador"
          required
          value={description}
        />
      </label>
      <div className="expense-form__row">
        <label className="form-field">
          <span>Valor total</span>
          <input
            disabled={busy}
            inputMode="decimal"
            onChange={(event) => {
              setAmount(event.target.value);
            }}
            placeholder="0,00"
            required
            value={amount}
          />
        </label>
        <label className="form-field">
          <span>Pago agora</span>
          <input
            disabled={busy}
            inputMode="decimal"
            onChange={(event) => {
              setInitialPayment(event.target.value);
            }}
            placeholder="0,00"
            value={initialPayment}
          />
        </label>
      </div>
      <div className="expense-form__row">
        <label className="form-field">
          <span>Forma de pagamento</span>
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
      </div>
      <label className="form-field">
        <span>Observação</span>
        <input
          disabled={busy}
          maxLength={240}
          onChange={(event) => {
            setNote(event.target.value);
          }}
          placeholder="Opcional"
          value={note}
        />
      </label>
      <button
        className="button button--primary"
        disabled={
          busy ||
          category.trim().length < 2 ||
          description.trim().length < 2 ||
          parseCurrencyInput(amount) <= 0 ||
          parseCurrencyInput(initialPayment) > parseCurrencyInput(amount)
        }
        type="submit"
      >
        Registrar despesa
      </button>
    </form>
  );
}
