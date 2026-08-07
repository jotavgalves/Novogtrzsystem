import { useCallback, useEffect, useState } from 'react';

import type {
  CreateComboInput,
  ComboDeletePreview,
  InventoryCombo,
  InventoryProduct,
  UpdateComboInput,
} from '@gtrz/contracts';

interface ComboViewState {
  readonly combos: readonly InventoryCombo[];
  readonly loading: boolean;
  readonly busy: boolean;
  readonly error: string | null;
  readonly message: string | null;
  readonly reload: () => Promise<void>;
  readonly createCombo: (input: CreateComboInput) => Promise<void>;
  readonly updateCombo: (input: UpdateComboInput) => Promise<void>;
  readonly previewDeleteCombo: (comboId: string) => Promise<ComboDeletePreview>;
  readonly deleteCombo: (comboId: string, reason: string) => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível atualizar os combos.';
}

export function useCombos(products: readonly InventoryProduct[]): ComboViewState {
  const [combos, setCombos] = useState<readonly InventoryCombo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      setCombos(await window.gtrz.combos.list());
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [products, reload]);

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
        const failureMessage = getErrorMessage(operationError);
        setError(failureMessage);
        throw new Error(failureMessage);
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  const createCombo = useCallback(
    async (input: CreateComboInput): Promise<void> => {
      await run(() => window.gtrz.combos.create(input), 'Combo cadastrado.');
    },
    [run],
  );

  const updateCombo = useCallback(
    async (input: UpdateComboInput): Promise<void> => {
      await run(() => window.gtrz.combos.update(input), 'Combo atualizado.');
    },
    [run],
  );

  const previewDeleteCombo = useCallback(async (comboId: string) => {
    return window.gtrz.combos.previewDelete({ comboId });
  }, []);

  const deleteCombo = useCallback(
    async (comboId: string, reason: string): Promise<void> => {
      await run(() => window.gtrz.combos.delete({ comboId, reason }), 'Combo excluído.');
    },
    [run],
  );

  return {
    combos,
    loading,
    busy,
    error,
    message,
    reload,
    createCombo,
    updateCombo,
    previewDeleteCombo,
    deleteCombo,
  };
}
