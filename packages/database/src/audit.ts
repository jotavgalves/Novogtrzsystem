import { getSessionState } from './control';
import type { DatabaseContext } from './types';

const CURRENT_AUDIT_SCHEMA_VERSION = 1;

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

function getRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function nullableJson(value: unknown): string | null {
  const record = getRecord(value);
  return record === null ? null : JSON.stringify(record);
}

function buildVersionedMetadata(value: unknown): Readonly<Record<string, unknown>> {
  return {
    ...(getRecord(value) ?? {}),
    schemaVersion: CURRENT_AUDIT_SCHEMA_VERSION,
  };
}

export function appendAudit(database: DatabaseContext, input: AuditInput): void {
  const details = input.details ?? {};
  const before = input.before ?? details.before;
  const after = input.after ?? details.after;
  const impact = input.impact ?? details.impact;
  const metadata = buildVersionedMetadata(input.metadata ?? details.metadata);
  const correlationId = input.correlationId ?? getString(details.correlationId);

  database.sqlite
    .prepare(
      `INSERT INTO audit_log
       (
         event_id,
         profile,
         actor_identifier,
         action,
         entity_type,
         entity_id,
         correlation_id,
         details_json,
         before_json,
         after_json,
         impact_json,
         metadata_json,
         created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.eventId ?? null,
      getSessionState(database).profile,
      input.actorIdentifier ?? null,
      input.action,
      input.entityType,
      input.entityId ?? null,
      correlationId,
      JSON.stringify(details),
      nullableJson(before),
      nullableJson(after),
      nullableJson(impact),
      JSON.stringify(metadata),
      Date.now(),
    );
}
