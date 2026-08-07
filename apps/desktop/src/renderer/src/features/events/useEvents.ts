import { useCallback, useEffect, useState } from 'react';

import type { EventStatus, GtrzEvent } from '@gtrz/contracts';

import { useSession } from '../../shared/session/session-context';

interface EventsState {
  readonly events: readonly GtrzEvent[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly create: (name: string, startsAt: number) => Promise<void>;
  readonly rename: (eventId: string, name: string) => Promise<void>;
  readonly changeStatus: (eventId: string, status: EventStatus) => Promise<void>;
  readonly deleteEvent: (eventId: string) => Promise<void>;
  readonly select: (eventId: string) => Promise<void>;
  readonly reload: () => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível atualizar os eventos.';
}

export function useEvents(): EventsState {
  const [events, setEvents] = useState<readonly GtrzEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setActiveEvent } = useSession();

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      setEvents(await window.gtrz.events.list());
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const executeAndReload = useCallback(
    async (operation: () => Promise<unknown>): Promise<void> => {
      setError(null);

      try {
        await operation();
        await reload();
      } catch (operationError: unknown) {
        const message = getErrorMessage(operationError);
        setError(message);
        throw new Error(message);
      }
    },
    [reload],
  );

  const create = useCallback(
    async (name: string, startsAt: number): Promise<void> => {
      await executeAndReload(() => window.gtrz.events.create({ name, startsAt }));
    },
    [executeAndReload],
  );

  const rename = useCallback(
    async (eventId: string, name: string): Promise<void> => {
      await executeAndReload(() => window.gtrz.events.rename({ eventId, name }));
    },
    [executeAndReload],
  );

  const changeStatus = useCallback(
    async (eventId: string, status: EventStatus): Promise<void> => {
      await executeAndReload(() => window.gtrz.events.changeStatus({ eventId, status }));
    },
    [executeAndReload],
  );

  const deleteEvent = useCallback(
    async (eventId: string): Promise<void> => {
      await executeAndReload(() => window.gtrz.events.delete({ eventId }));
    },
    [executeAndReload],
  );

  const select = useCallback(
    async (eventId: string): Promise<void> => {
      setError(null);

      try {
        await setActiveEvent(eventId);
      } catch (selectionError: unknown) {
        const message = getErrorMessage(selectionError);
        setError(message);
        throw new Error(message);
      }
    },
    [setActiveEvent],
  );

  return {
    events,
    loading,
    error,
    create,
    rename,
    changeStatus,
    deleteEvent,
    select,
    reload,
  };
}
