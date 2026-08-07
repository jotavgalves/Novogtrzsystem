import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  closeOrder,
  createEvent,
  getOperationState,
  getOrder,
  openDatabase,
  openOrder,
  type DatabaseContext,
} from './index';
import { isDatabaseError } from './database-error';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-operation-errors-'));
  return openDatabase(path.join(temporaryDirectory, 'operation-errors.sqlite'));
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

describe('operation stable error codes', () => {
  it('classifica comanda inexistente e fechamento de comanda vazia', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento POS tipado', startsAt: Date.now() });

    expect(captureDatabaseError(() => getOrder(database, 'missing-order'))).toEqual({
      code: 'NOT_FOUND',
      details: { orderId: 'missing-order' },
    });

    const counter = getOperationState(database).servicePoints[0];
    expect(counter).toBeDefined();
    const order = openOrder(database, counter?.id ?? 'missing-counter');
    expect(
      captureDatabaseError(() =>
        closeOrder(database, {
          orderId: order.id,
          discountCents: 0,
          payments: [],
          voucherUses: [],
        }),
      ),
    ).toEqual({ code: 'INVALID_STATE', details: { orderId: order.id, itemCount: 0 } });
    database.close();
  });
});
