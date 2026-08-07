import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createEvent,
  createExpense,
  openDatabase,
  payExpense,
  previewCancelExpense,
  switchProfile,
  type DatabaseContext,
} from './index';
import { isDatabaseError } from './database-error';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-expense-errors-'));
  return openDatabase(path.join(temporaryDirectory, 'expense-errors.sqlite'));
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

describe('expense stable error codes', () => {
  it('classifica despesa inexistente e pagamento acima do saldo pendente', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento despesas tipadas', startsAt: Date.now() });

    expect(
      captureDatabaseError(() => previewCancelExpense(database, { expenseId: 'missing' })),
    ).toEqual({
      code: 'NOT_FOUND',
      details: { expenseId: 'missing' },
    });

    const expense = createExpense(database, {
      category: 'Estrutura',
      description: 'Locação tipada',
      amountCents: 1000,
      initialPaymentCents: 0,
      paymentMethod: 'pix',
    });
    expect(
      captureDatabaseError(() =>
        payExpense(database, {
          expenseId: expense.id,
          amountCents: 1200,
          paymentMethod: 'pix',
        }),
      ),
    ).toEqual({
      code: 'INVALID_STATE',
      details: { expenseId: expense.id, requestedCents: 1200, pendingCents: 1000 },
    });
    database.close();
  });

  it('classifica administração de despesas no perfil Caixa como proibida', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento despesas caixa', startsAt: Date.now() });
    switchProfile(database, 'cashier');

    expect(
      captureDatabaseError(() =>
        createExpense(database, {
          category: 'Estrutura',
          description: 'Bloqueada',
          amountCents: 1000,
          paymentMethod: 'cash',
        }),
      ),
    ).toEqual({ code: 'FORBIDDEN', details: { requiredProfile: 'production' } });
    database.close();
  });
});
