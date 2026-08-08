import { appendAudit } from './audit';
import { getSessionState } from './control';
import { failDatabaseOperation } from './database-error';
import type { DatabaseContext } from './types';

function metaKey(eventId: string): string {
  return `service_point_pins:${eventId}`;
}

export function getPinnedServicePointIds(
  database: DatabaseContext,
  eventId: string,
): ReadonlySet<string> {
  const row = database.sqlite
    .prepare('SELECT value FROM app_meta WHERE key = ?')
    .get(metaKey(eventId)) as { readonly value: string } | undefined;

  if (row === undefined) {
    return new Set<string>();
  }

  try {
    const parsed: unknown = JSON.parse(row.value);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((value): value is string => typeof value === 'string'))
      : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function persistPinnedIds(
  database: DatabaseContext,
  eventId: string,
  ids: ReadonlySet<string>,
): void {
  database.sqlite
    .prepare(
      `INSERT INTO app_meta (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(metaKey(eventId), JSON.stringify([...ids]), Date.now());
}

export function setServicePointPinned(
  database: DatabaseContext,
  input: { readonly servicePointId: string; readonly pinned: boolean },
): void {
  const eventId = getSessionState(database).activeEvent?.id;

  if (eventId === undefined) {
    failDatabaseOperation('INVALID_STATE', 'Selecione um evento antes de fixar mesas.', {
      requiredState: 'active-open-event',
    });
  }

  const servicePoint = database.sqlite
    .prepare(
      `SELECT id, event_id, label, type, active
       FROM service_points
       WHERE id = ?`,
    )
    .get(input.servicePointId) as
    | {
        readonly id: string;
        readonly event_id: string;
        readonly label: string;
        readonly type: 'table' | 'counter';
        readonly active: number;
      }
    | undefined;

  if (servicePoint?.event_id !== eventId || servicePoint.active !== 1) {
    failDatabaseOperation('NOT_FOUND', 'A mesa informada não existe no evento ativo.', {
      eventId,
      servicePointId: input.servicePointId,
    });
  }

  if (servicePoint.type !== 'table') {
    failDatabaseOperation('INVALID_STATE', 'Somente mesas podem ser fixadas.', {
      servicePointId: servicePoint.id,
      type: servicePoint.type,
    });
  }

  const ids = new Set(getPinnedServicePointIds(database, eventId));
  if (input.pinned) {
    ids.add(servicePoint.id);
  } else {
    ids.delete(servicePoint.id);
  }

  database.sqlite.transaction(() => {
    persistPinnedIds(database, eventId, ids);
    appendAudit(database, {
      action: input.pinned
        ? 'operations.service-point-pinned'
        : 'operations.service-point-unpinned',
      entityType: 'service-point',
      entityId: servicePoint.id,
      eventId,
      details: { label: servicePoint.label, pinned: input.pinned },
    });
  })();
}

export function forgetPinnedServicePoint(
  database: DatabaseContext,
  eventId: string,
  servicePointId: string,
): void {
  const ids = new Set(getPinnedServicePointIds(database, eventId));

  if (!ids.delete(servicePointId)) {
    return;
  }

  persistPinnedIds(database, eventId, ids);
}
