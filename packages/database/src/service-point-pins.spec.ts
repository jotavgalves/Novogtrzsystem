import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createEvent,
  createServicePoint,
  deleteServicePoint,
  getOperationState,
  openDatabase,
  setActiveEvent,
  setServicePointPinned,
  type DatabaseContext,
} from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-pins-'));
  return openDatabase(path.join(temporaryDirectory, 'pins.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

describe('service point pins', () => {
  it('fixa varias mesas, desafixa individualmente e remove pin ao excluir', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento mesas fixadas', startsAt: Date.now() });
    const tableA = createServicePoint(database, { label: 'Mesa A', type: 'table' });
    const tableB = createServicePoint(database, { label: 'Mesa B', type: 'table' });

    setServicePointPinned(database, { servicePointId: tableA.id, pinned: true });
    setServicePointPinned(database, { servicePointId: tableB.id, pinned: true });
    expect(
      getOperationState(database)
        .servicePoints.filter((item) => item.type === 'table')
        .map((item) => [item.label, item.pinned]),
    ).toEqual([
      ['Mesa A', true],
      ['Mesa B', true],
    ]);

    setServicePointPinned(database, { servicePointId: tableA.id, pinned: false });
    expect(
      getOperationState(database).servicePoints.find((item) => item.id === tableA.id)?.pinned,
    ).toBe(false);
    expect(
      getOperationState(database).servicePoints.find((item) => item.id === tableB.id)?.pinned,
    ).toBe(true);

    deleteServicePoint(database, {
      servicePointId: tableB.id,
      mode: 'keep-sales',
      reason: 'Retirada do mapa',
    });
    expect(getOperationState(database).servicePoints.some((item) => item.id === tableB.id)).toBe(
      false,
    );
    database.close();
  });

  it('mantem as preferencias isoladas entre eventos', async () => {
    const database = await createTemporaryDatabase();
    const first = createEvent(database, { name: 'Evento um', startsAt: Date.now() });
    const firstTable = createServicePoint(database, { label: 'Mesa 1', type: 'table' });
    setServicePointPinned(database, { servicePointId: firstTable.id, pinned: true });

    const second = createEvent(database, { name: 'Evento dois', startsAt: Date.now() + 1000 });
    setActiveEvent(database, second.id);
    const secondTable = createServicePoint(database, { label: 'Mesa 2', type: 'table' });
    expect(secondTable.pinned).toBe(false);
    setServicePointPinned(database, { servicePointId: secondTable.id, pinned: true });

    setActiveEvent(database, first.id);
    const firstState = getOperationState(database);
    expect(firstState.servicePoints.find((item) => item.id === firstTable.id)?.pinned).toBe(true);
    expect(firstState.servicePoints.some((item) => item.id === secondTable.id)).toBe(false);
    database.close();
  });
});
