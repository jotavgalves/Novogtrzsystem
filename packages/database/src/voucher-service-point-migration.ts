export const voucherServicePointMigration = {
  version: 11,
  name: 'voucher-service-point-links',
  sql: `
    ALTER TABLE vouchers ADD COLUMN linked_service_point_id TEXT
      REFERENCES service_points(id) ON UPDATE CASCADE ON DELETE RESTRICT;
    ALTER TABLE vouchers ADD COLUMN linked_service_point_label TEXT;

    CREATE INDEX vouchers_event_service_point_status_idx
      ON vouchers (event_id, linked_service_point_id, status, updated_at DESC);
  `,
} as const;
