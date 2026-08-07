import { createContext, useContext } from 'react';

import type { SessionState } from '@gtrz/contracts';

export interface SessionContextValue {
  readonly state: SessionState | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  readonly setActiveEvent: (eventId: string | null) => Promise<void>;
  readonly switchToCashier: () => Promise<void>;
  readonly switchToProduction: (password: string) => Promise<void>;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);

  if (context === null) {
    throw new Error('useSession deve ser usado dentro de SessionProvider.');
  }

  return context;
}
