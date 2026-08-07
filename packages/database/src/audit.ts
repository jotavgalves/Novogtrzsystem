import { writeAuditRecord } from './audit-write';
import { getSessionState } from './control';
import type { DatabaseContext } from './types';

interface AuditInput {
  readonly action: string;
  readonly entityType: string;
  readonly entityId?: string | null;
  readonly eventId?: string | null;
  readonly actorIdentifier?: string | null | undefined;
  readonly correlationId?: string | null | undefined;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly impact?: unknown;
  readonly metadata?: unknown;
}

export function appendAudit(database: DatabaseContext, input: AuditInput): void {
  writeAuditRecord(database, {
    ...input,
    profile: getSessionState(database).profile,
  });
}
