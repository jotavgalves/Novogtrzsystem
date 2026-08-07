import { useCallback, useEffect, useState } from 'react';

import type {
  CloseOrderInput,
  OperationCatalogItem,
  OperationState,
  Order,
  ServicePoint,
} from '@gtrz/contracts';

interface OperationsViewState {
  readonly state: OperationState | null;
  readonly order: Order | null;
  readonly loading: boolean;
  readonly busy: boolean;
  readonly error: string | null;
  readonly message: string | null;
  readonly reload: () => Promise<void>;
  readonly createTable: (label: string) => Promise<void>;
  readonly openServicePoint: (servicePoint: ServicePoint) => Promise<void>;
  readonly addItem: (item: OperationCatalogItem) => Promise<void>;
  readonly removeItem: (orderItemId: string) => Promise<void>;
  readonly bindVoucher: (code: string) => Promise<void>;
  readonly unbindVoucher: () => Promise<void>;
  readonly closeCurrentOrder: (input: Omit<CloseOrderInput, 'orderId'>) => Promise<void>;
  readonly cancelOrder: (orderId: string, reason: string) => Promise<void>;
  readonly clearOrder: () => void;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
}

export function useOperations(): OperationsViewState {
  const [state, setState] = useState<OperationState | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      setState(await window.gtrz.operations.getState());
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
    async <T>(operation: () => Promise<T>, successMessage?: string): Promise<T> => {
      setBusy(true);
      setError(null);
      setMessage(null);

      try {
        const result = await operation();
        await reload();

        if (successMessage !== undefined) {
          setMessage(successMessage);
        }

        return result;
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

  const createTable = useCallback(
    async (label: string): Promise<void> => {
      await run(
        () => window.gtrz.operations.createServicePoint({ label, type: 'table' }),
        'Mesa criada.',
      );
    },
    [run],
  );

  const openServicePoint = useCallback(
    async (servicePoint: ServicePoint): Promise<void> => {
      const selected = await run(() =>
        servicePoint.activeOrderId === null
          ? window.gtrz.operations.openOrder({ servicePointId: servicePoint.id })
          : window.gtrz.operations.getOrder(servicePoint.activeOrderId),
      );
      setOrder(selected);
    },
    [run],
  );

  const addItem = useCallback(
    async (item: OperationCatalogItem): Promise<void> => {
      if (order === null) {
        throw new Error('Abra uma mesa ou o balcão antes de adicionar itens.');
      }

      const updated = await run(() =>
        window.gtrz.operations.addItem({
          orderId: order.id,
          itemKind: item.kind,
          itemId: item.id,
          quantity: 1,
        }),
      );
      setOrder(updated);
    },
    [order, run],
  );

  const removeItem = useCallback(
    async (orderItemId: string): Promise<void> => {
      if (order === null) {
        return;
      }

      const updated = await run(() =>
        window.gtrz.operations.removeItem({ orderId: order.id, orderItemId }),
      );
      setOrder(updated);
    },
    [order, run],
  );

  const bindVoucher = useCallback(
    async (code: string): Promise<void> => {
      if (order === null) {
        throw new Error('Abra uma mesa ou o balcão antes de vincular um voucher.');
      }

      const updated = await run(
        () => window.gtrz.operations.bindVoucher({ orderId: order.id, code }),
        'Voucher vinculado à comanda.',
      );
      setOrder(updated);
    },
    [order, run],
  );

  const unbindVoucher = useCallback(async (): Promise<void> => {
    if (!order?.voucherAllocation) {
      return;
    }

    const updated = await run(
      () => window.gtrz.operations.unbindVoucher({ orderId: order.id }),
      'Voucher removido da comanda.',
    );
    setOrder(updated);
  }, [order, run]);

  const closeCurrentOrder = useCallback(
    async (input: Omit<CloseOrderInput, 'orderId'>): Promise<void> => {
      if (order === null) {
        throw new Error('Nenhuma comanda está aberta.');
      }

      await run(
        () => window.gtrz.operations.closeOrder({ orderId: order.id, ...input }),
        'Venda concluída e estoque atualizado.',
      );
      setOrder(null);
    },
    [order, run],
  );

  const cancelOrder = useCallback(
    async (orderId: string, reason: string): Promise<void> => {
      await run(
        () => window.gtrz.operations.cancelOrder({ orderId, reason }),
        'Comanda cancelada e operação auditada.',
      );

      if (order?.id === orderId) {
        setOrder(null);
      }
    },
    [order?.id, run],
  );

  const clearOrder = useCallback((): void => {
    setOrder(null);
    setError(null);
  }, []);

  return {
    state,
    order,
    loading,
    busy,
    error,
    message,
    reload,
    createTable,
    openServicePoint,
    addItem,
    removeItem,
    bindVoucher,
    unbindVoucher,
    closeCurrentOrder,
    cancelOrder,
    clearOrder,
  };
}
