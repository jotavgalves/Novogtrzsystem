export const financeMigration = {
  version: 8,
  name: 'cash-registers-and-expenses',
  sql: `
    CREATE TABLE cash_registers (
      id TEXT PRIMARY KEY NOT NULL,
      event_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
      opening_cash_cents INTEGER NOT NULL CHECK (opening_cash_cents >= 0),
      expected_cash_cents INTEGER NOT NULL,
      counted_cash_cents INTEGER CHECK (counted_cash_cents >= 0),
      variance_cents INTEGER,
      opened_at INTEGER NOT NULL,
      closed_at INTEGER,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (event_id) REFERENCES events(id) ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE INDEX cash_registers_status_updated_idx
      ON cash_registers (status, updated_at DESC);

    CREATE TABLE cash_movements (
      id TEXT PRIMARY KEY NOT NULL,
      event_id TEXT NOT NULL,
      cash_register_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('opening', 'supply', 'withdrawal')),
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      note TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (event_id) REFERENCES events(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY (cash_register_id) REFERENCES cash_registers(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE INDEX cash_movements_register_created_idx
      ON cash_movements (cash_register_id, created_at DESC);
    CREATE INDEX cash_movements_event_created_idx
      ON cash_movements (event_id, created_at DESC);

    CREATE TABLE expenses (
      id TEXT PRIMARY KEY NOT NULL,
      event_id TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      payment_method TEXT NOT NULL CHECK (
        payment_method IN ('cash', 'pix', 'credit-card', 'debit-card')
      ),
      note TEXT,
      status TEXT NOT NULL CHECK (status IN ('active', 'cancelled')),
      created_at INTEGER NOT NULL,
      cancelled_at INTEGER,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (event_id) REFERENCES events(id) ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE INDEX expenses_event_status_created_idx
      ON expenses (event_id, status, created_at DESC);
  `,
} as const;
