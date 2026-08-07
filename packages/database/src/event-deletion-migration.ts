export const eventDeletionMigration = {
  version: 14,
  name: 'event-logical-deletion',
  sql: `
    ALTER TABLE events ADD COLUMN deleted_at INTEGER;

    CREATE INDEX events_deleted_status_starts_idx
      ON events (deleted_at, status, starts_at DESC);
  `,
} as const;
