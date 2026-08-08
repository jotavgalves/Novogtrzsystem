import { failDatabaseOperation } from './database-error';
import { getPinnedServicePointIds } from './service-point-pins';
import type { DatabaseServicePoint, DatabaseServicePointType } from './service-point-types';
import type { DatabaseContext } from './types';
import type { DatabaseVoucher } from './voucher-types';

interface ServicePointRow {
  readonly id: string;
  readonly event_id: string;
  readonly label: string;
  readonly type: DatabaseServicePointType;
  readonly active_order_id: string | null;
  readonly active_order_total_cents: number;
  readonly created_at: number;
  readonly updated_at: number;
}

function mapServicePoint(row: ServicePointRow, pinned: boolean): DatabaseServicePoint {
  return {
    id: row.id,
    eventId: row.event_id,
    label: row.label,
    type: row.type,
    status: row.active_order_id === null ? 'available' : 'open',
    activeOrderId: row.active_order_id,
    activeOrderTotalCents: row.active_order_total_cents,
    pinned,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listVoucherServicePoints(
  database: DatabaseContext,
  eventId: string,
): readonly DatabaseServicePoint[] {
  const rows = database.sqlite
    .prepare(
      `SELECT
         sp.id,
         sp.event_id,
         sp.label,
         sp.type,
         o.id AS active_order_id,
         COALESCE(o.total_cents, 0) AS active_order_total_cents,
         sp.created_at,
         sp.updated_at
       FROM service_points sp
       LEFT JOIN orders o
         ON o.service_point_id = sp.id
        AND o.status = 'open'
       WHERE sp.event_id = ? AND sp.active = 1 AND sp.type = 'table'
       ORDER BY sp.label COLLATE NOCASE`,
    )
    .all(eventId) as ServicePointRow[];
  const pinnedIds = getPinnedServicePointIds(database, eventId);
  return rows.map((row) => mapServicePoint(row, pinnedIds.has(row.id)));
}

export function resolveLinkedServicePoint(
  database: DatabaseContext,
  eventId: string,
  linkedServicePointId: string | null | undefined,
): Pick<DatabaseVoucher, 'linkedServicePointId' | 'linkedServicePointLabel'> {
  if (linkedServicePointId === undefined || linkedServicePointId === null) {
    return { linkedServicePointId: null, linkedServicePointLabel: null };
  }

  const servicePoint = database.sqlite
    .prepare(
      `SELECT id, label
       FROM service_points
       WHERE id = ? AND event_id = ? AND active = 1 AND type = 'table'`,
    )
    .get(linkedServicePointId, eventId) as
    | { readonly id: string; readonly label: string }
    | undefined;

  if (servicePoint === undefined) {
    failDatabaseOperation('NOT_FOUND', 'A mesa vinculada ao voucher não existe no evento ativo.', {
      eventId,
      servicePointId: linkedServicePointId,
    });
  }

  return {
    linkedServicePointId: servicePoint.id,
    linkedServicePointLabel: servicePoint.label,
  };
}
