import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createEvent,
  getReceiptSettings,
  openDatabase,
  switchProfile,
  updateReceiptSettings,
  type DatabaseContext,
} from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-receipts-'));
  return openDatabase(path.join(temporaryDirectory, 'receipts.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

describe('receipt settings', () => {
  it('inicia desativada e persiste impressora e largura', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento recibos', startsAt: Date.now() });

    expect(getReceiptSettings(database)).toEqual({
      autoPrint: false,
      printerName: null,
      paperWidthMm: 58,
    });
    expect(
      updateReceiptSettings(database, {
        autoPrint: true,
        printerName: 'THERMAL-01',
        paperWidthMm: 80,
      }),
    ).toEqual({
      autoPrint: true,
      printerName: 'THERMAL-01',
      paperWidthMm: 80,
    });
    expect(getReceiptSettings(database)).toEqual({
      autoPrint: true,
      printerName: 'THERMAL-01',
      paperWidthMm: 80,
    });
    database.close();
  });

  it('impede o perfil Caixa de alterar a configuracao', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento recibos caixa', startsAt: Date.now() });
    switchProfile(database, 'cashier');

    expect(() =>
      updateReceiptSettings(database, {
        autoPrint: true,
        printerName: null,
        paperWidthMm: 58,
      }),
    ).toThrow('A configuração de impressão exige o perfil Produção.');
    database.close();
  });
});
