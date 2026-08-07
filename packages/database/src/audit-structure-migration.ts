export const auditStructureMigration = {
  version: 13,
  name: 'structured-audit-pagination',
  sql: `
    ALTER TABLE audit_log ADD COLUMN actor_identifier TEXT;
    ALTER TABLE audit_log ADD COLUMN correlation_id TEXT;
    ALTER TABLE audit_log ADD COLUMN before_json TEXT;
    ALTER TABLE audit_log ADD COLUMN after_json TEXT;
    ALTER TABLE audit_log ADD COLUMN impact_json TEXT;
    ALTER TABLE audit_log ADD COLUMN metadata_json TEXT;

    CREATE INDEX audit_log_entity_created_idx
      ON audit_log (entity_type, entity_id, created_at DESC);
    CREATE INDEX audit_log_correlation_created_idx
      ON audit_log (correlation_id, created_at DESC);
    CREATE INDEX audit_log_profile_created_idx
      ON audit_log (profile, created_at DESC);
  `,
} as const;
