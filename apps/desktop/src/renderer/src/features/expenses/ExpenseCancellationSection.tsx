import { Ban, Eye } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { Expense, ExpenseCancelPreview } from '@gtrz/contracts';
import { formatCurrency } from '@gtrz/domain';

interface ExpenseCancellationSectionProps {
  readonly expense: Expense;
  readonly busy: boolean;
  readonly onPreviewCancel: (expenseId: string) => Promise<ExpenseCancelPreview>;
  readonly onCancel: (expenseId: string, reason: string) => Promise<void>;
}

export function ExpenseCancellationSection({
  expense,
  busy,
  onPreviewCancel,
  onCancel,
}: ExpenseCancellationSectionProps): React.JSX.Element {
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<ExpenseCancelPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  useEffect(() => {
    setPreview(null);
  }, [expense.updatedAt]);

  if (expense.status === 'cancelled') {
    return <></>;
  }

  return (
    <section className="expense-cancel-section">
      {preview === null ? (
        <button
          className="button button--ghost"
          disabled={busy || previewBusy}
          onClick={() => {
            setPreviewBusy(true);
            void onPreviewCancel(expense.id)
              .then((result) => {
                setPreview(result);
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
              {preview.activePaymentCount} pagamento(s) ativo(s) serão estornados e o histórico será
              preservado.
            </small>
          </div>
          <dl>
            <div>
              <dt>Total da obrigação</dt>
              <dd>{formatCurrency(preview.totalCents)}</dd>
            </div>
            <div>
              <dt>Total já pago a estornar</dt>
              <dd>{formatCurrency(preview.refundTotalCents)}</dd>
            </div>
            <div>
              <dt>Impacto em dinheiro</dt>
              <dd>{formatCurrency(preview.refundCashCents)}</dd>
            </div>
            <div>
              <dt>Outros meios</dt>
              <dd>{formatCurrency(preview.refundDigitalCents)}</dd>
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
                setPreview(null);
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
                  setPreview(null);
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
  );
}
