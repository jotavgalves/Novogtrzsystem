import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createEvent,
  createServicePoint,
  createVoucher,
  deleteVoucher,
  getVoucherState,
  openDatabase,
  previewDeleteVoucher,
  type DatabaseContext,
} from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-voucher-delete-'));
  return openDatabase(path.join(temporaryDirectory, 'vouchers.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

describe('voucher permanent deletion', () => {
  it('apaga definitivamente voucher que nunca foi usado', async () => {
    const database = await createTemporaryDatabase();

    try {
      createEvent(database, { name: 'Evento voucher sem uso', startsAt: Date.now() });
      const table = createServicePoint(database, { label: 'Mesa 9', type: 'table' });
      const voucher = createVoucher(database, {
        code: 'SEM-USO',
        label: 'Voucher errado',
        linkedServicePointId: table.id,
        initialBalanceCents: 3000,
      });
      const preview = previewDeleteVoucher(database, { voucherId: voucher.id });

      expect(preview).toMatchObject({
        deletionMode: 'permanent',
        allAllocations: 0,
        nonIssueTransactions: 0,
        paidOrders: 0,
      });
      deleteVoucher(database, { voucherId: voucher.id, reason: 'Emitido por engano' });

      expect(
        getVoucherState(database).vouchers.find((item) => item.id === voucher.id),
      ).toBeUndefined();
      expect(
        database.sqlite
          .prepare('SELECT COUNT(*) AS value FROM voucher_transactions WHERE voucher_id = ?')
          .get(voucher.id),
      ).toEqual({ value: 0 });
      expect(
        database.sqlite
          .prepare(
            "SELECT COUNT(*) AS value FROM audit_log WHERE action = 'voucher.permanently-deleted' AND entity_id = ?",
          )
          .get(voucher.id),
      ).toEqual({ value: 1 });
    } finally {
      database.close();
    }
  });
});
