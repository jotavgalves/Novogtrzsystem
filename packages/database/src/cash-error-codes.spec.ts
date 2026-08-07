import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createEvent,
  openCashRegister,
  openDatabase,
  recordCashMovement,
  switchProfile,
  type DatabaseContext,
} from './index';
import { isDatabaseError } from './database-error';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-cash-errors-'));
  return openDatabase(path.join(temporaryDirectory, 'cash-errors.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

function captureDatabaseError(operation: () => unknown): {
  readonly code: string;
  readonly details: Readonly<Record<string, unknown>> | null;
} {
  try {
    operation();
  } catch (error: unknown) {
    expect(isDatabaseError(error)).toBe(true);

    if (isDatabaseError(error)) {
      return { code: error.code, details: error.details };
    }
  }

  throw new Error('A operação deveria ter falhado com um erro tipado.');
}

describe('cash stable error codes', () => {
  it('classifica caixa ausente, abertura duplicada e valor inválido', async () => {
    const database = await createTemporaryDatabase();
    const event = createEvent(database, { name: 'Evento caixa tipado', startsAt: Date.now() });

    expect(
      captureDatabaseError(() =>
        recordCashMovement(database, { type: 'supply', amountCents: 100 }),
      ),
    ).toEqual({
      code: 'INVALID_STATE',
      details: { eventId: event.id, requiredState: 'open-cash-register' },
    });

    openCashRegister(database, 500);
    expect(captureDatabaseError(() => openCashRegister(database, 100))).toEqual({
      code: 'CONFLICT',
      details: { eventId: event.id },
    });
    database.close();
  });

  it('classifica administração do caixa no perfil Caixa como proibida', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento caixa restrito', startsAt: Date.now() });
    switchProfile(database, 'cashier');

    expect(captureDatabaseError(() => openCashRegister(database, 0))).toEqual({
      code: 'FORBIDDEN',
      details: { requiredProfile: 'production' },
    });
    database.close();
  });
});
