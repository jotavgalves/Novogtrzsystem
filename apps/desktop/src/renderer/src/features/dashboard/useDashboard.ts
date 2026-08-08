import { useCallback, useEffect, useRef, useState } from 'react';

import type { DashboardState } from '@gtrz/contracts';

interface DashboardViewState {
  readonly state: DashboardState | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly reload: () => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível carregar a visão geral.';
}

export function useDashboard(): DashboardViewState {
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestInFlight = useRef(false);

  const load = useCallback(async (background = false): Promise<void> => {
    if (requestInFlight.current) {
      return;
    }

    requestInFlight.current = true;
    if (!background) {
      setLoading(true);
    }
    setError(null);

    try {
      setState(await window.gtrz.dashboard.getState());
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError));
    } finally {
      requestInFlight.current = false;
      if (!background) {
        setLoading(false);
      }
    }
  }, []);

  const reload = useCallback(async (): Promise<void> => {
    await load(false);
  }, [load]);

  useEffect(() => {
    void load(false);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load(true);
      }
    }, 2000);

    return () => {
      window.clearInterval(timer);
    };
  }, [load]);

  return { state, loading, error, reload };
}
