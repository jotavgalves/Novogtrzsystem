import { getSessionState } from './control';
import type { DatabaseContext } from './types';
import type { DatabaseVoucher } from './voucher-types';
import { mapVoucher, type VoucherRow } from './vouchers';

export function listAvailableVouchersForServicePoint(
  database: DatabaseContext,
  input: { readonly servicePointId: string },
): readonly DatabaseVoucher[] {
  const eventId = getSessionState(database).activeEvent?.id;

  if (eventId === undefined) {
    return [];
  }

  const servicePoint = database.sqlite
    .prepare('SELECT id FROM service_points WHERE id = ? AND event_id = ? AND active = 1')
    .get(input.servicePointId, eventId);

  if (servicePoint === undefined) {
    throw new Error('A mesa informada não existe no evento ativo.');
  }

  const rows = database.sqlite
    .prepare(
      `SELECT id, event_id, code, label, linked_service_point_id, linked_service_point_label,
              initial_balance_cents, remaining_balance_cents, status, created_at, updated_at
       FROM vouchers
       WHERE event_id = ?
         AND linked_service_point_id = ?
         AND status = 'active'
         AND remaining_balance_cents > 0
       ORDER BY label COLLATE NOCASE, code COLLATE NOCASE`,
    )
    .all(eventId, input.servicePointId) as VoucherRow[];

  return rows.map(mapVoucher);
}
