export const ticketMigration = {
  version: 9,
  name: 'ticket-lots-sales-and-codes',
  sql: `
    CREATE TABLE ticket_lots (
      id TEXT PRIMARY KEY NOT NULL,
      event_id TEXT NOT NULL,
      name TEXT NOT NULL COLLATE NOCASE,
      price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
      capacity INTEGER NOT NULL CHECK (capacity > 0),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (event_id) REFERENCES events(id) ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE UNIQUE INDEX ticket_lots_event_name_unique
      ON ticket_lots (event_id, name COLLATE NOCASE);
    CREATE INDEX ticket_lots_event_active_updated_idx
      ON ticket_lots (event_id, active, updated_at DESC);

    CREATE TABLE ticket_sales (
      id TEXT PRIMARY KEY NOT NULL,
      event_id TEXT NOT NULL,
      lot_id TEXT NOT NULL,
      lot_name TEXT NOT NULL,
      attendee_name TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('sympla', 'whatsapp', 'door', 'courtesy')),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
      total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
      payment_method TEXT CHECK (
        payment_method IS NULL OR
        payment_method IN ('cash', 'pix', 'credit-card', 'debit-card')
      ),
      status TEXT NOT NULL CHECK (status IN ('active', 'cancelled')),
      created_at INTEGER NOT NULL,
      cancelled_at INTEGER,
      updated_at INTEGER NOT NULL,
      CHECK (
        (source = 'courtesy' AND total_cents = 0 AND payment_method IS NULL) OR
        (source != 'courtesy' AND payment_method IS NOT NULL)
      ),
      FOREIGN KEY (event_id) REFERENCES events(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY (lot_id) REFERENCES ticket_lots(id) ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE INDEX ticket_sales_event_status_created_idx
      ON ticket_sales (event_id, status, created_at DESC);
    CREATE INDEX ticket_sales_lot_status_created_idx
      ON ticket_sales (lot_id, status, created_at DESC);
    CREATE INDEX ticket_sales_payment_status_idx
      ON ticket_sales (event_id, payment_method, status);

    CREATE TABLE ticket_codes (
      id TEXT PRIMARY KEY NOT NULL,
      event_id TEXT NOT NULL,
      sale_id TEXT NOT NULL,
      code TEXT NOT NULL COLLATE NOCASE,
      status TEXT NOT NULL CHECK (status IN ('valid', 'cancelled')),
      created_at INTEGER NOT NULL,
      FOREIGN KEY (event_id) REFERENCES events(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY (sale_id) REFERENCES ticket_sales(id) ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE UNIQUE INDEX ticket_codes_event_code_unique
      ON ticket_codes (event_id, code COLLATE NOCASE);
    CREATE INDEX ticket_codes_sale_created_idx
      ON ticket_codes (sale_id, created_at);
  `,
} as const;
