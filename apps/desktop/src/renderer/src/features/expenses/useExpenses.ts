import { useCallback, useEffect, useState } from 'react';

import type {
  CreateExpenseInput,
  ExpenseCancelPreview,
  ExpenseState,
  PaymentMethod,
  UpdateExpenseInput,
} from '@gtrz/contracts';

import { getAppErrorMessage } from '../../shared/app-error';

interface ExpenseViewState {
  readonly state: ExpenseState | null;
  readonly loading: boolean;
  readonly busy: boolean;
  readonly error: string | null;
  readonly message: string | null;
  readonly reload: () => Promise<void>;
  readonly createExpense: (input: CreateExpenseInput) => Promise<void>;
  readonly updateExpense: (input: UpdateExpenseInput) => Promise<void>;
  readonly payExpense: (
    expenseId: string,
    amountCents: number,
    paymentMethod: PaymentMethod,
    note?: string,
  ) => Promise<void>;
  readonly refundExpensePayment: (paymentId: string, reason: string) => Promise<void>;
  readonly previewCancelExpense: (expenseId: string) => Promise<ExpenseCancelPreview>;
  readonly cancelExpense: (expenseId: string, reason: string) => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  return getAppErrorMessage(error, 'Não foi possível atualizar as despesas.');
}

export function useExpenses(): ExpenseViewState {
  const [state, setState] = useState<ExpenseState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      setState(await window.gtrz.expenses.getState());
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = useCallback(
    async (operation: () => Promise<unknown>, successMessage: string): Promise<void> => {
      setBusy(true);
      setError(null);
      setMessage(null);

      try {
        await operation();
        await reload();
        setMessage(successMessage);
      } catch (operationError: unknown) {
        setError(getErrorMessage(operationError));
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  const createExpense = useCallback(
    async (input: CreateExpenseInput): Promise<void> => {
      await run(() => window.gtrz.expenses.create(input), 'Despesa registrada.');
    },
    [run],
  );

  const updateExpense = useCallback(
    async (input: UpdateExpenseInput): Promise<void> => {
      await run(() => window.gtrz.expenses.update(input), 'Despesa atualizada.');
    },
    [run],
  );

  const payExpense = useCallback(
    async (
      expenseId: string,
      amountCents: number,
      paymentMethod: PaymentMethod,
      note?: string,
    ): Promise<void> => {
      const input =
        note === undefined || note.trim().length === 0
          ? { expenseId, amountCents, paymentMethod }
          : { expenseId, amountCents, paymentMethod, note: note.trim() };
      await run(() => window.gtrz.expenses.pay(input), 'Pagamento de despesa registrado.');
    },
    [run],
  );

  const refundExpensePayment = useCallback(
    async (paymentId: string, reason: string): Promise<void> => {
      await run(
        () => window.gtrz.expenses.refundPayment({ paymentId, reason }),
        'Parcela da despesa estornada.',
      );
    },
    [run],
  );

  const previewCancelExpense = useCallback(
    async (expenseId: string): Promise<ExpenseCancelPreview> => {
      setError(null);
      try {
        return await window.gtrz.expenses.previewCancel({ expenseId });
      } catch (previewError: unknown) {
        setError(getErrorMessage(previewError));
        throw previewError;
      }
    },
    [],
  );

  const cancelExpense = useCallback(
    async (expenseId: string, reason: string): Promise<void> => {
      await run(() => window.gtrz.expenses.cancel({ expenseId, reason }), 'Despesa cancelada.');
    },
    [run],
  );

  return {
    state,
    loading,
    busy,
    error,
    message,
    reload,
    createExpense,
    updateExpense,
    payExpense,
    refundExpensePayment,
    previewCancelExpense,
    cancelExpense,
  };
}
