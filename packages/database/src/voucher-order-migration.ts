export const voucherOrderMigration = {
  version: 10,
  name: 'voucher-order-allocations',
  sql: `
    CREATE TABLE order_voucher_allocations (
      order_id TEXT PRIMARY KEY NOT NULL,
      event_id TEXT NOT NULL,
      voucher_id TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY (event_id) REFERENCES events(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE INDEX order_voucher_allocations_event_updated_idx
      ON order_voucher_allocations (event_id, updated_at DESC);
  `,
} as const;
