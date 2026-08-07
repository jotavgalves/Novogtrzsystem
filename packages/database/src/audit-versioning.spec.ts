import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createEvent, getAuditState, openDatabase, type DatabaseContext } from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-audit-version-'));
  return openDatabase(path.join(temporaryDirectory, 'audit-version.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

describe('audit payload versioning', () => {
  it('marca novos registros como schema 1 e mantém registros históricos sem versão como schema 0', async () => {
    const database = await createTemporaryDatabase();
    const event = createEvent(database, { name: 'Evento auditoria versionada', startsAt: Date.now() });

    database.sqlite
      .prepare(
        `INSERT INTO audit_log
         (event_id, profile, actor_identifier, action, entity_type, entity_id, correlation_id,
          details_json, before_json, after_json, impact_json, metadata_json, created_at)
         VALUES (?, 'production', NULL, 'legacy.action', 'legacy', 'legacy-1', NULL,
                 '{}', NULL, NULL, NULL, NULL, ?)`,
      )
      .run(event.id, Date.now() + 1);

    const audit = getAuditState(database, { eventId: event.id, limit: 20 });
    const createdEventRecord = audit.records.find((record) => record.action === 'event.created');
    const legacyRecord = audit.records.find((record) => record.action === 'legacy.action');

    expect(createdEventRecord).toMatchObject({
      schemaVersion: 1,
      metadata: { schemaVersion: 1 },
    });
    expect(legacyRecord).toMatchObject({
      schemaVersion: 0,
      metadata: null,
    });
    database.close();
  });
});
