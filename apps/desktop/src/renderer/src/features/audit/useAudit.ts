import { useCallback, useEffect, useState } from 'react';

import type { AuditQueryInput, AuditState } from '@gtrz/contracts';

interface AuditViewState {
  readonly state: AuditState | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly load: (
    input?: AuditQueryInput,
    options?: { readonly append?: boolean },
  ) => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível carregar a auditoria.';
}

export function useAudit(): AuditViewState {
  const [state, setState] = useState<AuditState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (
      input: AuditQueryInput = { limit: 100, offset: 0 },
      options: { readonly append?: boolean } = {},
    ): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const nextState = await window.gtrz.audit.list(input);
        setState((currentState) =>
          options.append === true && currentState !== null
            ? { ...nextState, records: [...currentState.records, ...nextState.records] }
            : nextState,
        );
      } catch (loadError: unknown) {
        setError(getErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { state, loading, error, load };
}
