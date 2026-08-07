import { Ban, CreditCard, Eye, Pencil, RotateCcw, Save, WalletCards, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import type {
  Expense,
  ExpenseCancelPreview,
  PaymentMethod,
  UpdateExpenseInput,
} from '@gtrz/contracts';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from '@gtrz/domain';

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
  onUpdate,
  onPay,
  onRefundPayment,
  onPreviewCancel,
  onCancel,
}: ExpenseCardProps): React.JSX.Element {
  const [reason, setReason] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [paymentNote, setPaymentNote] = useState('');
  const [refundReasons, setRefundReasons] = useState<Readonly<Record<string, string>>>({});
  const [editing, setEditing] = useState(false);
  const [editCategory, setEditCategory] = useState(expense.category);
  const [editDescription, setEditDescription] = useState(expense.description);
  const [editTotal, setEditTotal] = useState(formatCurrencyInput(expense.totalCents));
  const [editNote, setEditNote] = useState(expense.note ?? '');
  const [cancelPreview, setCancelPreview] = useState<ExpenseCancelPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const canPay = expense.status !== 'cancelled' && expense.pendingCents > 0;
  const editTotalCents = parseCurrencyInput(editTotal);

  useEffect(() => {
    if (editing) {
      return;
    }

    setEditCategory(expense.category);
    setEditDescription(expense.description);
    setEditTotal(formatCurrencyInput(expense.totalCents));
    setEditNote(expense.note ?? '');
  }, [editing, expense.category, expense.description, expense.note, expense.totalCents]);

  useEffect(() => {
    setCancelPreview(null);
  }, [expense.updatedAt]);

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

      {expense.status !== 'cancelled' ? (
        <div className="expense-card__admin-actions">
          <button
            className="button button--secondary button--compact"
            disabled={busy}
            onClick={() => {
              setEditing((current) => !current);
            }}
            type="button"
          >
            {editing ? <X size={15} aria-hidden="true" /> : <Pencil size={15} aria-hidden="true" />}
            {editing ? 'Fechar edição' : 'Editar despesa'}
          </button>
        </div>
      ) : null}

      {editing && expense.status !== 'cancelled' ? (
        <form
          className="expense-edit-form"
          onSubmit={(event) => {
            event.preventDefault();

            if (
              editCategory.trim().length < 2 ||
              editDescription.trim().length < 2 ||
              editTotalCents <= 0 ||
              editTotalCents < expense.paidCents
            ) {
              return;
            }

            const normalizedNote = editNote.trim();
            void onUpdate({
              expenseId: expense.id,
              category: editCategory.trim(),
              description: editDescription.trim(),
              amountCents: editTotalCents,
              ...(normalizedNote.length === 0 ? {} : { note: normalizedNote }),
            });
          }}
        >
          <label className="form-field">
            <span>Categoria</span>
            <input
              disabled={busy}
              maxLength={80}
              onChange={(event) => {
                setEditCategory(event.target.value);
              }}
              value={editCategory}
            />
          </label>
          <label className="form-field">
            <span>Descrição</span>
            <input
              disabled={busy}
              maxLength={160}
              onChange={(event) => {
                setEditDescription(event.target.value);
              }}
              value={editDescription}
            />
          </label>
          <label className="form-field">
            <span>Valor total</span>
            <input
              aria-invalid={editTotalCents > 0 && editTotalCents < expense.paidCents}
              disabled={busy}
              inputMode="decimal"
              onChange={(event) => {
                setEditTotal(event.target.value);
              }}
              value={editTotal}
            />
            {editTotalCents > 0 && editTotalCents < expense.paidCents ? (
              <small>
                O total não pode ficar abaixo de {formatCurrency(expense.paidCents)} já pagos.
              </small>
            ) : null}
          </label>
          <label className="form-field">
            <span>Observação</span>
            <input
              disabled={busy}
              maxLength={240}
              onChange={(event) => {
                setEditNote(event.target.value);
              }}
              placeholder="Opcional"
              value={editNote}
            />
          </label>
          <button
            className="button button--primary"
            disabled={
              busy ||
              editCategory.trim().length < 2 ||
              editDescription.trim().length < 2 ||
              editTotalCents <= 0 ||
              editTotalCents < expense.paidCents
            }
            type="submit"
          >
            <Save size={15} aria-hidden="true" />
            Salvar alterações
          </button>
        </form>
      ) : null}

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
            className="button button--secondary"
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
        <section className="expense-cancel-section">
          {cancelPreview === null ? (
            <button
              className="button button--ghost"
              disabled={busy || previewBusy}
              onClick={() => {
                setPreviewBusy(true);
                void onPreviewCancel(expense.id)
                  .then((preview) => {
                    setCancelPreview(preview);
                  })
                  .finally(() => {
                    setPreviewBusy(false);
                  });
              }}
              type="button"
            >
              <Eye size={15} aria-hidden="true" />
              {previewBusy ? 'Calculando impacto…' : 'Ver impacto do cancelamento'}
            </button>
          ) : (
            <div className="expense-cancel-preview">
              <div>
                <strong>Impacto antes de cancelar</strong>
                <small>
                  {cancelPreview.activePaymentCount} pagamento(s) ativo(s) serão estornados e o
                  histórico será preservado.
                </small>
              </div>
              <dl>
                <div>
                  <dt>Total da obrigação</dt>
                  <dd>{formatCurrency(cancelPreview.totalCents)}</dd>
                </div>
                <div>
                  <dt>Total já pago a estornar</dt>
                  <dd>{formatCurrency(cancelPreview.refundTotalCents)}</dd>
                </div>
                <div>
                  <dt>Impacto em dinheiro</dt>
                  <dd>{formatCurrency(cancelPreview.refundCashCents)}</dd>
                </div>
                <div>
                  <dt>Outros meios</dt>
                  <dd>{formatCurrency(cancelPreview.refundDigitalCents)}</dd>
                </div>
              </dl>
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
                    setCancelPreview(null);
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
                <div className="expense-cancel-form__actions">
                  <button
                    className="button button--ghost"
                    disabled={busy}
                    onClick={() => {
                      setCancelPreview(null);
                      setReason('');
                    }}
                    type="button"
                  >
                    Voltar
                  </button>
                  <button
                    className="button button--danger"
                    disabled={busy || reason.trim().length < 3}
                    type="submit"
                  >
                    <Ban size={15} aria-hidden="true" />
                    Confirmar cancelamento
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      ) : null}
    </article>
  );
}
