import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  changeVoucherStatus,
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

describe('voucher deletion after deactivation', () => {
  it('permite apagar definitivamente voucher desativado que nunca foi usado', async () => {
    const database = await createTemporaryDatabase();

    try {
      createEvent(database, { name: 'Evento voucher descartável', startsAt: Date.now() });
      const table = createServicePoint(database, { label: 'Mesa descartável', type: 'table' });
      const voucher = createVoucher(database, {
        code: 'DESCARTAR-01',
        label: 'Voucher lançado errado',
        linkedServicePointId: table.id,
        initialBalanceCents: 5000,
      });

      changeVoucherStatus(database, { voucherId: voucher.id, status: 'cancelled' });
      const preview = previewDeleteVoucher(database, { voucherId: voucher.id });

      expect(preview.deletionMode).toBe('permanent');
      expect(preview.nonIssueTransactions).toBe(0);

      deleteVoucher(database, {
        voucherId: voucher.id,
        reason: 'Voucher cadastrado por engano',
      });

      expect(getVoucherState(database).vouchers.some((item) => item.id === voucher.id)).toBe(false);
    } finally {
      database.close();
    }
  });
});