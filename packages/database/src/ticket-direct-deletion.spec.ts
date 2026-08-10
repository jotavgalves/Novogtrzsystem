import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createEvent,
  createTicketLot,
  createTicketSale,
  deleteTicketCode,
  deleteTicketLot,
  deleteTicketSale,
  getCashState,
  getTicketState,
  openDatabase,
  type DatabaseContext,
} from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-ticket-delete-'));
  return openDatabase(path.join(temporaryDirectory, 'tickets.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

describe('ticket direct deletion', () => {
  it('exclui ingresso válido diretamente e recalcula quantidade e receita da venda', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Exclusão individual', startsAt: Date.now() });
    const lot = createTicketLot(database, { name: 'Lote A', priceCents: 2500, capacity: 5 });
    const sale = createTicketSale(database, {
      lotId: lot.id,
      attendeeName: 'Grupo',
      source: 'door',
      quantity: 2,
      paymentMethod: 'cash',
      manualCodes: ['DEL-001', 'DEL-002'],
    });

    deleteTicketCode(database, {
      codeId: sale.codes[0]?.id ?? '',
      reason: 'Ingresso lançado por engano',
    });

    const state = getTicketState(database);
    expect(state.sales[0]).toMatchObject({ quantity: 1, totalCents: 2500, status: 'active' });
    expect(state.sales[0]?.codes).toHaveLength(1);
    expect(state.lots[0]).toMatchObject({ soldQuantity: 1, availableQuantity: 4 });
    expect(getCashState(database).salesByMethod.cashCents).toBe(2500);
    database.close();
  });

  it('exclui venda ativa diretamente aplicando o estorno antes da remoção', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Exclusão de venda', startsAt: Date.now() });
    const lot = createTicketLot(database, { name: 'Lote B', priceCents: 3000, capacity: 4 });
    const sale = createTicketSale(database, {
      lotId: lot.id,
      attendeeName: 'Venda errada',
      source: 'whatsapp',
      quantity: 2,
      paymentMethod: 'pix',
    });

    deleteTicketSale(database, { saleId: sale.id, reason: 'Registro inserido incorretamente' });

    const state = getTicketState(database);
    expect(state.sales).toHaveLength(0);
    expect(state.lots[0]).toMatchObject({ soldQuantity: 0, availableQuantity: 4 });
    expect(state.activeRevenueCents).toBe(0);
    expect(getCashState(database).salesByMethod.pixCents).toBe(0);
    database.close();
  });

  it('remove lote com histórico da operação sem apagar as vendas existentes', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Exclusão de lote', startsAt: Date.now() });
    const lot = createTicketLot(database, { name: 'Lote C', priceCents: 4000, capacity: 10 });
    const sale = createTicketSale(database, {
      lotId: lot.id,
      attendeeName: 'Venda preservada',
      source: 'door',
      quantity: 1,
      paymentMethod: 'cash',
    });

    deleteTicketLot(database, { lotId: lot.id, reason: 'Lote retirado da venda' });

    const state = getTicketState(database);
    expect(state.lots[0]).toMatchObject({ id: lot.id, active: false });
    expect(state.sales[0]).toMatchObject({ id: sale.id, status: 'active', totalCents: 4000 });
    expect(state.activeRevenueCents).toBe(4000);
    database.close();
  });
});
