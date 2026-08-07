import { Pencil, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { Expense, UpdateExpenseInput } from '@gtrz/contracts';
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from '@gtrz/domain';

interface ExpenseEditSectionProps {
  readonly expense: Expense;
  readonly busy: boolean;
  readonly onUpdate: (input: UpdateExpenseInput) => Promise<void>;
}

export function ExpenseEditSection({
  expense,
  busy,
  onUpdate,
}: ExpenseEditSectionProps): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState(expense.category);
  const [description, setDescription] = useState(expense.description);
  const [total, setTotal] = useState(formatCurrencyInput(expense.totalCents));
  const [note, setNote] = useState(expense.note ?? '');
  const totalCents = parseCurrencyInput(total);

  useEffect(() => {
    if (editing) {
      return;
    }

    setCategory(expense.category);
    setDescription(expense.description);
    setTotal(formatCurrencyInput(expense.totalCents));
    setNote(expense.note ?? '');
  }, [editing, expense.category, expense.description, expense.note, expense.totalCents]);

  if (expense.status === 'cancelled') {
    return <></>;
  }

  return (
    <>
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

      {editing ? (
        <form
          className="expense-edit-form"
          onSubmit={(event) => {
            event.preventDefault();

            if (
              category.trim().length < 2 ||
              description.trim().length < 2 ||
              totalCents <= 0 ||
              totalCents < expense.paidCents
            ) {
              return;
            }

            const normalizedNote = note.trim();
            void onUpdate({
              expenseId: expense.id,
              category: category.trim(),
              description: description.trim(),
              amountCents: totalCents,
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
                setCategory(event.target.value);
              }}
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
              value={description}
            />
          </label>
          <label className="form-field">
            <span>Valor total</span>
            <input
              aria-invalid={totalCents > 0 && totalCents < expense.paidCents}
              disabled={busy}
              inputMode="decimal"
              onChange={(event) => {
                setTotal(event.target.value);
              }}
              value={total}
            />
            {totalCents > 0 && totalCents < expense.paidCents ? (
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
              totalCents <= 0 ||
              totalCents < expense.paidCents
            }
            type="submit"
          >
            <Save size={15} aria-hidden="true" />
            Salvar alterações
          </button>
        </form>
      ) : null}
    </>
  );
}
