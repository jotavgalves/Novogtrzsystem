import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  cancelTicketCode,
  createEvent,
  createTicketLot,
  createTicketSale,
  getCashState,
  getTicketState,
  openDatabase,
  type DatabaseContext,
} from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-ticket-courtesy-'));
  return openDatabase(path.join(temporaryDirectory, 'ticket-courtesy.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

describe('ticket courtesy cancellation', () => {
  it('restaura capacidade ao cancelar cortesia individual sem gerar estorno financeiro', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento cortesia cancelada', startsAt: Date.now() });
    const lot = createTicketLot(database, {
      name: 'Lote cortesia cancelável',
      priceCents: 6000,
      capacity: 3,
    });
    const sale = createTicketSale(database, {
      lotId: lot.id,
      attendeeName: 'Convidados',
      source: 'courtesy',
      quantity: 2,
      manualCodes: ['CORT-001', 'CORT-002'],
    });
    const codeId = sale.codes[0]?.id;

    if (codeId === undefined) {
      throw new Error('Código de cortesia não criado.');
    }

    expect(getCashState(database).grossSalesCents).toBe(0);
    expect(getTicketState(database).lots[0]?.availableQuantity).toBe(1);

    const partiallyCancelled = cancelTicketCode(database, {
      codeId,
      reason: 'Convidado não comparecerá',
    });

    expect(partiallyCancelled).toMatchObject({
      source: 'courtesy',
      status: 'active',
      quantity: 1,
      totalCents: 0,
    });
    expect(getTicketState(database).lots[0]?.availableQuantity).toBe(2);
    expect(getCashState(database).grossSalesCents).toBe(0);

    const audit = database.sqlite
      .prepare(
        `SELECT impact_json, correlation_id
         FROM audit_log
         WHERE action = 'ticket.code-cancelled' AND entity_id = ?
         ORDER BY id DESC LIMIT 1`,
      )
      .get(codeId) as
      | { readonly impact_json: string; readonly correlation_id: string | null }
      | undefined;
    expect(JSON.parse(audit?.impact_json ?? '{}')).toMatchObject({
      refundedCents: 0,
      restoredUnits: 1,
    });
    expect(audit?.correlation_id).not.toBeNull();
    database.close();
  });
});
