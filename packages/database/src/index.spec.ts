import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  changeEventStatus,
  changeProductionPassword,
  createDatabaseSnapshot,
  createEvent,
  deleteEvent,
  ensureControlDefaults,
  getSessionState,
  listEvents,
  openDatabase,
  switchProfile,
  verifyDatabaseFile,
  verifyDatabaseIntegrity,
  type DatabaseContext,
} from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-database-'));
  const databasePath = path.join(temporaryDirectory, 'test.sqlite');
  const database = openDatabase(databasePath);
  ensureControlDefaults(database);
  return database;
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

describe('database foundation', () => {
  it('cria o arquivo, aplica migrações e passa na verificação de integridade', async () => {
    const database = await createTemporaryDatabase();

    expect(verifyDatabaseIntegrity(database)).toBe(true);

    const migrationTable: unknown = database.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
      .get();
    const eventTable: unknown = database.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'events'")
      .get();
    const auditTable: unknown = database.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'audit_log'")
      .get();

    expect(migrationTable).toBeDefined();
    expect(eventTable).toBeDefined();
    expect(auditTable).toBeDefined();
    database.close();
  });

  it('cria o primeiro evento e o seleciona automaticamente', async () => {
    const database = await createTemporaryDatabase();
    const created = createEvent(database, {
      name: 'La Rumba Neon',
      startsAt: 1_786_000_000_000,
    });

    expect(listEvents(database)).toHaveLength(1);
    expect(getSessionState(database)).toEqual({
      profile: 'production',
      activeEvent: created,
    });
    database.close();
  });

  it('bloqueia operações administrativas no perfil Caixa e exige a senha ao retornar', async () => {
    const database = await createTemporaryDatabase();

    expect(switchProfile(database, 'cashier')).toMatchObject({ profile: 'cashier' });
    expect(() => createEvent(database, { name: 'Evento bloqueado', startsAt: Date.now() })).toThrow(
      'Esta operação exige o perfil Produção.',
    );
    expect(() => switchProfile(database, 'production', 'senha-incorreta')).toThrow(
      'Senha de Produção inválida.',
    );
    expect(switchProfile(database, 'production', '121225')).toMatchObject({
      profile: 'production',
    });
    database.close();
  });

  it('remove o evento ativo ao encerrar e permite alterar a senha de Produção', async () => {
    const database = await createTemporaryDatabase();
    const created = createEvent(database, {
      name: 'Evento encerrado',
      startsAt: Date.now(),
    });

    changeEventStatus(database, { eventId: created.id, status: 'closed' });
    expect(getSessionState(database).activeEvent).toBeNull();

    changeProductionPassword(database, '121225', 'nova-senha-segura');
    switchProfile(database, 'cashier');
    expect(() => switchProfile(database, 'production', '121225')).toThrow(
      'Senha de Produção inválida.',
    );
    expect(switchProfile(database, 'production', 'nova-senha-segura')).toMatchObject({
      profile: 'production',
    });
    database.close();
  });

  it('apaga evento logicamente, preserva trilha e limpa seleção ativa', async () => {
    const database = await createTemporaryDatabase();
    const created = createEvent(database, {
      name: 'Evento apagável',
      startsAt: Date.now(),
    });

    expect(deleteEvent(database, { eventId: created.id })).toMatchObject({
      id: created.id,
      name: 'Evento apagável',
    });

    expect(listEvents(database).map((event) => event.id)).not.toContain(created.id);
    expect(getSessionState(database).activeEvent).toBeNull();
    expect(() => deleteEvent(database, { eventId: created.id })).toThrow(
      'O evento informado não existe.',
    );

    const audit = database.sqlite
      .prepare(
        `SELECT action, before_json, after_json, impact_json
         FROM audit_log
         WHERE entity_id = ? AND action = 'event.deleted'`,
      )
      .get(created.id) as
      | {
          readonly action: string;
          readonly before_json: string;
          readonly after_json: string;
          readonly impact_json: string;
        }
      | undefined;

    expect(audit?.action).toBe('event.deleted');
    expect(JSON.parse(audit?.before_json ?? '{}')).toMatchObject({ status: 'open' });
    expect(JSON.parse(audit?.after_json ?? '{}')).toHaveProperty('deletedAt');
    expect(JSON.parse(audit?.impact_json ?? '{}')).toMatchObject({
      hiddenFromOperationalList: true,
    });
    database.close();
  });

  it('gera snapshot consistente e rejeita arquivo SQLite corrompido', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento no snapshot', startsAt: Date.now() });
    const snapshotPath = path.join(temporaryDirectory ?? '', 'snapshot.sqlite');
    const invalidPath = path.join(temporaryDirectory ?? '', 'invalid.sqlite');

    await createDatabaseSnapshot(database, snapshotPath);
    expect(verifyDatabaseFile(snapshotPath)).toBe(true);

    const snapshot = openDatabase(snapshotPath);
    expect(listEvents(snapshot).map((event) => event.name)).toContain('Evento no snapshot');
    snapshot.close();

    await writeFile(invalidPath, 'arquivo inválido', 'utf8');
    expect(verifyDatabaseFile(invalidPath)).toBe(false);
    database.close();
  });
});
