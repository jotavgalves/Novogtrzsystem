import { useCallback, useEffect, useState } from 'react';

import type {
  CreateProductInput,
  ProductDeletePreview,
  InventoryState,
  RecordStockMovementInput,
  UpdateProductInput,
} from '@gtrz/contracts';

interface InventoryViewState {
  readonly state: InventoryState | null;
  readonly loading: boolean;
  readonly busy: boolean;
  readonly error: string | null;
  readonly message: string | null;
  readonly reload: () => Promise<void>;
  readonly createCategory: (name: string) => Promise<void>;
  readonly createProduct: (input: CreateProductInput) => Promise<void>;
  readonly updateProduct: (input: UpdateProductInput) => Promise<void>;
  readonly previewDeleteProduct: (productId: string) => Promise<ProductDeletePreview>;
  readonly deleteProduct: (productId: string, reason: string) => Promise<void>;
  readonly recordMovement: (input: RecordStockMovementInput) => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível atualizar o estoque.';
}

export function useInventory(): InventoryViewState {
  const [state, setState] = useState<InventoryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      setState(await window.gtrz.inventory.getState());
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
    async (operation: () => Promise<unknown>, successMessage: string) => {
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

  const createCategory = useCallback(
    async (name: string): Promise<void> => {
      await run(() => window.gtrz.inventory.createCategory({ name }), 'Categoria criada.');
    },
    [run],
  );

  const createProduct = useCallback(
    async (input: CreateProductInput): Promise<void> => {
      await run(() => window.gtrz.inventory.createProduct(input), 'Produto cadastrado.');
    },
    [run],
  );

  const updateProduct = useCallback(
    async (input: UpdateProductInput): Promise<void> => {
      await run(() => window.gtrz.inventory.updateProduct(input), 'Produto atualizado.');
    },
    [run],
  );

  const previewDeleteProduct = useCallback(async (productId: string) => {
    return window.gtrz.inventory.previewDeleteProduct({ productId });
  }, []);

  const deleteProduct = useCallback(
    async (productId: string, reason: string): Promise<void> => {
      await run(
        () => window.gtrz.inventory.deleteProduct({ productId, reason }),
        'Produto excluído.',
      );
    },
    [run],
  );

  const recordMovement = useCallback(
    async (input: RecordStockMovementInput): Promise<void> => {
      await run(() => window.gtrz.inventory.recordMovement(input), 'Estoque atualizado.');
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
    createCategory,
    createProduct,
    updateProduct,
    previewDeleteProduct,
    deleteProduct,
    recordMovement,
  };
}
