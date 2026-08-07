import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

import type { DatabaseContext } from './types';

export type DatabaseUserProfile = 'production' | 'cashier';
export type DatabaseEventStatus = 'open' | 'closed' | 'archived';

export interface DatabaseEvent {
  readonly id: string;
  readonly name: string;
  readonly status: DatabaseEventStatus;
  readonly startsAt: number;
  readonly endsAt: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface DatabaseSessionState {
  readonly profile: DatabaseUserProfile;
  readonly activeEvent: DatabaseEvent | null;
}

interface EventRow {
  readonly id: string;
  readonly name: string;
  readonly status: DatabaseEventStatus;
  readonly starts_at: number;
  readonly ends_at: number | null;
  readonly created_at: number;
  readonly updated_at: number;
  readonly deleted_at: number | null;
}

const META_KEYS = {
  activeEventId: 'active_event_id',
  currentProfile: 'current_profile',
  productionPasswordHash: 'production_password_hash',
  productionPasswordSalt: 'production_password_salt',
} as const;

const DEFAULT_PRODUCTION_PASSWORD = '121225';

function mapEvent(row: EventRow): DatabaseEvent {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getMeta(database: DatabaseContext, key: string): string | null {
  const row = database.sqlite.prepare('SELECT value FROM app_meta WHERE key = ?').get(key) as
    | { readonly value: string }
    | undefined;
  return row?.value ?? null;
}

function setMeta(database: DatabaseContext, key: string, value: string): void {
  database.sqlite
    .prepare(
      `INSERT INTO app_meta (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, value, Date.now());
}

function deleteMeta(database: DatabaseContext, key: string): void {
  database.sqlite.prepare('DELETE FROM app_meta WHERE key = ?').run(key);
}

function derivePassword(password: string, salt: string): Buffer {
  return scryptSync(password, salt, 64);
}

function storeProductionPassword(database: DatabaseContext, password: string): void {
  const salt = randomBytes(24).toString('hex');
  const hash = derivePassword(password, salt).toString('hex');
  setMeta(database, META_KEYS.productionPasswordSalt, salt);
  setMeta(database, META_KEYS.productionPasswordHash, hash);
}

function verifyProductionPassword(database: DatabaseContext, password: string): boolean {
  const salt = getMeta(database, META_KEYS.productionPasswordSalt);
  const storedHash = getMeta(database, META_KEYS.productionPasswordHash);

  if (salt === null || storedHash === null) {
    return false;
  }

  const actualHash = derivePassword(password, salt);
  const expectedHash = Buffer.from(storedHash, 'hex');

  return actualHash.length === expectedHash.length && timingSafeEqual(actualHash, expectedHash);
}

function getProfile(database: DatabaseContext): DatabaseUserProfile {
  return getMeta(database, META_KEYS.currentProfile) === 'cashier' ? 'cashier' : 'production';
}

function getEventById(database: DatabaseContext, eventId: string): DatabaseEvent | null {
  const row = database.sqlite
    .prepare(
      `SELECT id, name, status, starts_at, ends_at, created_at, updated_at
       FROM events WHERE id = ? AND deleted_at IS NULL`,
    )
    .get(eventId) as EventRow | undefined;
  return row === undefined ? null : mapEvent(row);
}

function getAnyEventById(database: DatabaseContext, eventId: string): EventRow | null {
  const row = database.sqlite
    .prepare(
      `SELECT id, name, status, starts_at, ends_at, created_at, updated_at, deleted_at
       FROM events WHERE id = ?`,
    )
    .get(eventId) as EventRow | undefined;
  return row ?? null;
}

function requireEvent(database: DatabaseContext, eventId: string): DatabaseEvent {
  const event = getEventById(database, eventId);

  if (event === null) {
    throw new Error('O evento informado não existe.');
  }

  return event;
}

function requireProduction(database: DatabaseContext): void {
  if (getProfile(database) !== 'production') {
    throw new Error('Esta operação exige o perfil Produção.');
  }
}

function writeAudit(
  database: DatabaseContext,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Readonly<Record<string, unknown>>,
  eventId: string | null = null,
  structured: {
    readonly before?: Readonly<Record<string, unknown>>;
    readonly after?: Readonly<Record<string, unknown>>;
    readonly impact?: Readonly<Record<string, unknown>>;
  } = {},
): void {
  database.sqlite
    .prepare(
      `INSERT INTO audit_log
       (
         event_id,
         profile,
         action,
         entity_type,
         entity_id,
         details_json,
         before_json,
         after_json,
         impact_json,
         created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      eventId,
      getProfile(database),
      action,
      entityType,
      entityId,
      JSON.stringify(details),
      structured.before === undefined ? null : JSON.stringify(structured.before),
      structured.after === undefined ? null : JSON.stringify(structured.after),
      structured.impact === undefined ? null : JSON.stringify(structured.impact),
      Date.now(),
    );
}

export function ensureControlDefaults(database: DatabaseContext): void {
  const initialize = database.sqlite.transaction(() => {
    if (getMeta(database, META_KEYS.currentProfile) === null) {
      setMeta(database, META_KEYS.currentProfile, 'production');
    }

    if (
      getMeta(database, META_KEYS.productionPasswordSalt) === null ||
      getMeta(database, META_KEYS.productionPasswordHash) === null
    ) {
      storeProductionPassword(database, DEFAULT_PRODUCTION_PASSWORD);
    }
  });

  initialize();
}

export function listEvents(database: DatabaseContext): readonly DatabaseEvent[] {
  const rows = database.sqlite
    .prepare(
      `SELECT id, name, status, starts_at, ends_at, created_at, updated_at
       FROM events
       WHERE deleted_at IS NULL
       ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'closed' THEN 1 ELSE 2 END,
                starts_at DESC,
                created_at DESC`,
    )
    .all() as EventRow[];
  return rows.map(mapEvent);
}

export function deleteEvent(
  database: DatabaseContext,
  input: { readonly eventId: string },
): DatabaseEvent {
  requireProduction(database);
  const current = getAnyEventById(database, input.eventId);

  if (current?.deleted_at !== null) {
    throw new Error('O evento informado não existe.');
  }

  const deleted = mapEvent(current);
  const now = Date.now();

  database.sqlite.transaction(() => {
    database.sqlite
      .prepare('UPDATE events SET deleted_at = ?, updated_at = ? WHERE id = ?')
      .run(now, now, input.eventId);

    if (getMeta(database, META_KEYS.activeEventId) === input.eventId) {
      deleteMeta(database, META_KEYS.activeEventId);
    }

    writeAudit(
      database,
      'event.deleted',
      'event',
      input.eventId,
      {
        before: {
          name: current.name,
          status: current.status,
        },
      },
      input.eventId,
      {
        before: { name: current.name, status: current.status },
        after: { deletedAt: now },
        impact: { hiddenFromOperationalList: true },
      },
    );
  })();

  return deleted;
}

export function createEvent(
  database: DatabaseContext,
  input: { readonly name: string; readonly startsAt: number },
): DatabaseEvent {
  requireProduction(database);
  const now = Date.now();
  const eventId = randomUUID();
  const name = input.name.trim();

  const create = database.sqlite.transaction(() => {
    database.sqlite
      .prepare(
        `INSERT INTO events
         (id, name, status, starts_at, ends_at, created_at, updated_at)
         VALUES (?, ?, 'open', ?, NULL, ?, ?)`,
      )
      .run(eventId, name, input.startsAt, now, now);

    if (getMeta(database, META_KEYS.activeEventId) === null) {
      setMeta(database, META_KEYS.activeEventId, eventId);
    }

    writeAudit(
      database,
      'event.created',
      'event',
      eventId,
      {
        name,
        startsAt: input.startsAt,
      },
      eventId,
    );
  });

  create();
  return requireEvent(database, eventId);
}

export function renameEvent(
  database: DatabaseContext,
  input: { readonly eventId: string; readonly name: string },
): DatabaseEvent {
  requireProduction(database);
  const current = requireEvent(database, input.eventId);
  const name = input.name.trim();

  database.sqlite.transaction(() => {
    database.sqlite
      .prepare('UPDATE events SET name = ?, updated_at = ? WHERE id = ?')
      .run(name, Date.now(), input.eventId);
    writeAudit(
      database,
      'event.renamed',
      'event',
      input.eventId,
      {
        after: name,
        before: current.name,
      },
      input.eventId,
    );
  })();

  return requireEvent(database, input.eventId);
}

export function changeEventStatus(
  database: DatabaseContext,
  input: { readonly eventId: string; readonly status: DatabaseEventStatus },
): DatabaseEvent {
  requireProduction(database);
  const current = requireEvent(database, input.eventId);

  if (current.status === input.status) {
    return current;
  }

  const now = Date.now();
  const endsAt = input.status === 'closed' ? now : input.status === 'open' ? null : current.endsAt;

  database.sqlite.transaction(() => {
    database.sqlite
      .prepare('UPDATE events SET status = ?, ends_at = ?, updated_at = ? WHERE id = ?')
      .run(input.status, endsAt, now, input.eventId);

    if (input.status !== 'open' && getMeta(database, META_KEYS.activeEventId) === input.eventId) {
      deleteMeta(database, META_KEYS.activeEventId);
    }

    writeAudit(
      database,
      `event.${input.status}`,
      'event',
      input.eventId,
      {
        after: input.status,
        before: current.status,
      },
      input.eventId,
    );
  })();

  return requireEvent(database, input.eventId);
}

export function getSessionState(database: DatabaseContext): DatabaseSessionState {
  const activeEventId = getMeta(database, META_KEYS.activeEventId);
  const activeEvent = activeEventId === null ? null : getEventById(database, activeEventId);

  if (activeEventId !== null && activeEvent === null) {
    deleteMeta(database, META_KEYS.activeEventId);
    return { profile: getProfile(database), activeEvent: null };
  }

  if (activeEvent !== null && activeEvent.status !== 'open') {
    deleteMeta(database, META_KEYS.activeEventId);
    return { profile: getProfile(database), activeEvent: null };
  }

  return {
    profile: getProfile(database),
    activeEvent,
  };
}

export function setActiveEvent(
  database: DatabaseContext,
  eventId: string | null,
): DatabaseSessionState {
  requireProduction(database);

  database.sqlite.transaction(() => {
    if (eventId === null) {
      deleteMeta(database, META_KEYS.activeEventId);
      writeAudit(database, 'event.selection-cleared', 'event', null, {});
      return;
    }

    const event = requireEvent(database, eventId);

    if (event.status !== 'open') {
      throw new Error('Somente eventos abertos podem ser selecionados para operação.');
    }

    setMeta(database, META_KEYS.activeEventId, eventId);
    writeAudit(database, 'event.selected', 'event', eventId, { name: event.name }, eventId);
  })();

  return getSessionState(database);
}

export function switchProfile(
  database: DatabaseContext,
  targetProfile: DatabaseUserProfile,
  password?: string,
): DatabaseSessionState {
  const currentProfile = getProfile(database);

  if (currentProfile === targetProfile) {
    return getSessionState(database);
  }

  if (
    targetProfile === 'production' &&
    (password === undefined || !verifyProductionPassword(database, password))
  ) {
    throw new Error('Senha de Produção inválida.');
  }

  database.sqlite.transaction(() => {
    setMeta(database, META_KEYS.currentProfile, targetProfile);
    writeAudit(database, 'session.profile-changed', 'session', null, {
      after: targetProfile,
      before: currentProfile,
    });
  })();

  return getSessionState(database);
}

export function changeProductionPassword(
  database: DatabaseContext,
  currentPassword: string,
  newPassword: string,
): void {
  requireProduction(database);

  if (!verifyProductionPassword(database, currentPassword)) {
    throw new Error('A senha atual está incorreta.');
  }

  database.sqlite.transaction(() => {
    storeProductionPassword(database, newPassword);
    writeAudit(database, 'settings.production-password-changed', 'settings', null, {});
  })();
}
