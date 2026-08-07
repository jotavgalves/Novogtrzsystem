import { useCallback, useEffect, useState } from 'react';

import type {
  CreateTicketLotInput,
  CreateTicketSaleInput,
  TicketState,
  UpdateTicketLotInput,
} from '@gtrz/contracts';

interface TicketViewState {
  readonly state: TicketState | null;
  readonly loading: boolean;
  readonly busy: boolean;
  readonly error: string | null;
  readonly message: string | null;
  readonly reload: () => Promise<void>;
  readonly createLot: (input: CreateTicketLotInput) => Promise<void>;
  readonly updateLot: (input: UpdateTicketLotInput) => Promise<void>;
  readonly createSale: (input: CreateTicketSaleInput) => Promise<void>;
  readonly cancelSale: (saleId: string, reason: string) => Promise<void>;
  readonly cancelCode: (codeId: string, reason: string) => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível atualizar os ingressos.';
}

export function useTickets(): TicketViewState {
  const [state, setState] = useState<TicketState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      setState(await window.gtrz.tickets.getState());
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

  const createLot = useCallback(
    async (input: CreateTicketLotInput): Promise<void> => {
      await run(() => window.gtrz.tickets.createLot(input), 'Lote criado.');
    },
    [run],
  );

  const updateLot = useCallback(
    async (input: UpdateTicketLotInput): Promise<void> => {
      await run(() => window.gtrz.tickets.updateLot(input), 'Lote atualizado.');
    },
    [run],
  );

  const createSale = useCallback(
    async (input: CreateTicketSaleInput): Promise<void> => {
      await run(() => window.gtrz.tickets.createSale(input), 'Ingressos registrados.');
    },
    [run],
  );

  const cancelSale = useCallback(
    async (saleId: string, reason: string): Promise<void> => {
      await run(() => window.gtrz.tickets.cancelSale({ saleId, reason }), 'Venda cancelada.');
    },
    [run],
  );

  const cancelCode = useCallback(
    async (codeId: string, reason: string): Promise<void> => {
      await run(() => window.gtrz.tickets.cancelCode({ codeId, reason }), 'Ingresso cancelado.');
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
    createLot,
    updateLot,
    createSale,
    cancelSale,
    cancelCode,
  };
}
