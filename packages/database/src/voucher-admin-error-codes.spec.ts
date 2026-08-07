import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  changeVoucherStatus,
  createEvent,
  createVoucher,
  openDatabase,
  previewDeleteVoucher,
  updateVoucher,
  type DatabaseContext,
} from './index';
import { isDatabaseError } from './database-error';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-voucher-admin-errors-'));
  return openDatabase(path.join(temporaryDirectory, 'voucher-admin-errors.sqlite'));
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

describe('voucher administration stable error codes', () => {
  it('classifica prévia de exclusão de voucher cancelado como conflito', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento voucher cancelado', startsAt: Date.now() });
    const voucher = createVoucher(database, {
      code: 'CANCELADO-01',
      label: 'Voucher cancelado',
      initialBalanceCents: 1000,
    });
    changeVoucherStatus(database, { voucherId: voucher.id, status: 'cancelled' });

    expect(
      captureDatabaseError(() => previewDeleteVoucher(database, { voucherId: voucher.id })),
    ).toEqual({ code: 'CONFLICT', details: { voucherId: voucher.id, status: 'cancelled' } });
    database.close();
  });

  it('classifica mesa vinculada inexistente sem analisar a mensagem', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento mesa voucher', startsAt: Date.now() });
    const voucher = createVoucher(database, {
      code: 'MESA-ERRO-01',
      label: 'Voucher mesa erro',
      initialBalanceCents: 1000,
    });
    const missingServicePointId = '00000000-0000-4000-8000-000000000001';

    expect(
      captureDatabaseError(() =>
        updateVoucher(database, {
          voucherId: voucher.id,
          code: voucher.code,
          label: voucher.label,
          linkedServicePointId: missingServicePointId,
          addedBalanceCents: 0,
        }),
      ),
    ).toEqual({
      code: 'NOT_FOUND',
      details: { eventId: voucher.eventId, servicePointId: missingServicePointId },
    });
    database.close();
  });
});
