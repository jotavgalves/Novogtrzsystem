import { useCallback, useEffect, useState } from 'react';

import type { GtrzEvent, StockTransfer, TransferStockInput } from '@gtrz/contracts';

interface StockTransferViewState {
  readonly events: readonly GtrzEvent[];
  readonly transfers: readonly StockTransfer[];
  readonly loading: boolean;
  readonly busy: boolean;
  readonly error: string | null;
  readonly message: string | null;
  readonly reload: () => Promise<void>;
  readonly transfer: (input: TransferStockInput) => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível transferir o estoque.';
}

export function useStockTransfers(onTransferred: () => Promise<void>): StockTransferViewState {
  const [events, setEvents] = useState<readonly GtrzEvent[]>([]);
  const [transfers, setTransfers] = useState<readonly StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const [eventList, transferList] = await Promise.all([
        window.gtrz.events.list(),
        window.gtrz.inventory.listTransfers(),
      ]);
      setEvents(eventList);
      setTransfers(transferList);
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const transfer = useCallback(
    async (input: TransferStockInput): Promise<void> => {
      setBusy(true);
      setError(null);
      setMessage(null);

      try {
        await window.gtrz.inventory.transferStock(input);
        await Promise.all([reload(), onTransferred()]);
        setMessage('Transferência concluída de forma atômica.');
      } catch (transferError: unknown) {
        const failureMessage = getErrorMessage(transferError);
        setError(failureMessage);
        throw new Error(failureMessage);
      } finally {
        setBusy(false);
      }
    },
    [onTransferred, reload],
  );

  return { events, transfers, loading, busy, error, message, reload, transfer };
}
