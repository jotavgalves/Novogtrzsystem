export const expensePaymentsMigration = {
  version: 12,
  name: 'expense-payments-ledger',
  sql: `
    CREATE TABLE expense_payments (
      id TEXT PRIMARY KEY NOT NULL,
      event_id TEXT NOT NULL,
      expense_id TEXT NOT NULL,
      payment_method TEXT NOT NULL CHECK (
        payment_method IN ('cash', 'pix', 'credit-card', 'debit-card')
      ),
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      note TEXT,
      status TEXT NOT NULL CHECK (status IN ('active', 'refunded')),
      created_at INTEGER NOT NULL,
      refunded_at INTEGER,
      FOREIGN KEY (event_id) REFERENCES events(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE INDEX expense_payments_expense_created_idx
      ON expense_payments (expense_id, created_at DESC);
    CREATE INDEX expense_payments_event_status_created_idx
      ON expense_payments (event_id, status, created_at DESC);

    INSERT INTO expense_payments
      (id, event_id, expense_id, payment_method, amount_cents, note, status, created_at, refunded_at)
    SELECT
      lower(
        hex(randomblob(4)) || '-' ||
        hex(randomblob(2)) || '-4' ||
        substr(hex(randomblob(2)), 2) || '-' ||
        substr('89ab', abs(random()) % 4 + 1, 1) ||
        substr(hex(randomblob(2)), 2) || '-' ||
        hex(randomblob(6))
      ),
      event_id,
      id,
      payment_method,
      amount_cents,
      'Parcela criada pela migração de compatibilidade',
      'active',
      created_at,
      NULL
    FROM expenses
    WHERE status = 'active';
  `,
} as const;
