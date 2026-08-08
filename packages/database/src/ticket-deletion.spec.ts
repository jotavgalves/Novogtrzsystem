import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  cancelTicketCode,
  cancelTicketSale,
  createEvent,
  createTicketLot,
  createTicketSale,
  deleteTicketCode,
  deleteTicketLot,
  deleteTicketSale,
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

describe('ticket deletion', () => {
  it('exclui definitivamente lote que nunca teve vendas', async () => {
    const database = await createTemporaryDatabase();

    try {
      createEvent(database, { name: 'Evento exclusão lote', startsAt: Date.now() });
      const lot = createTicketLot(database, {
        name: 'Lote errado',
        priceCents: 5000,
        capacity: 100,
      });

      expect(
        deleteTicketLot(database, { lotId: lot.id, reason: 'Lote criado por engano' }),
      ).toEqual({
        success: true,
      });
      expect(getTicketState(database).lots.find((item) => item.id === lot.id)).toBeUndefined();
    } finally {
      database.close();
    }
  });

  it('bloqueia exclusão de lote com venda até o registro cancelado ser excluído', async () => {
    const database = await createTemporaryDatabase();

    try {
      createEvent(database, { name: 'Evento lote usado', startsAt: Date.now() });
      const lot = createTicketLot(database, {
        name: 'Lote usado',
        priceCents: 5000,
        capacity: 100,
      });
      const sale = createTicketSale(database, {
        lotId: lot.id,
        attendeeName: 'Cliente teste',
        source: 'door',
        quantity: 1,
        paymentMethod: 'pix',
      });

      expect(() => deleteTicketLot(database, { lotId: lot.id, reason: 'Remover lote' })).toThrow(
        'Este lote possui vendas ou cortesias registradas. Exclua esses registros primeiro.',
      );
      expect(() =>
        deleteTicketSale(database, { saleId: sale.id, reason: 'Remover venda' }),
      ).toThrow('Cancele a venda antes de excluir definitivamente o registro.');

      cancelTicketSale(database, { saleId: sale.id, reason: 'Venda duplicada' });
      expect(
        deleteTicketSale(database, { saleId: sale.id, reason: 'Limpar registro duplicado' }),
      ).toEqual({
        success: true,
      });
      expect(deleteTicketLot(database, { lotId: lot.id, reason: 'Lote de teste' })).toEqual({
        success: true,
      });
      expect(getTicketState(database)).toMatchObject({ lots: [], sales: [] });
    } finally {
      database.close();
    }
  });

  it('exclui código individual somente depois do cancelamento', async () => {
    const database = await createTemporaryDatabase();

    try {
      createEvent(database, { name: 'Evento código', startsAt: Date.now() });
      const lot = createTicketLot(database, {
        name: 'Lote código',
        priceCents: 2500,
        capacity: 10,
      });
      const sale = createTicketSale(database, {
        lotId: lot.id,
        attendeeName: 'Grupo teste',
        source: 'door',
        quantity: 2,
        paymentMethod: 'cash',
      });
      const code = sale.codes[0];

      expect(code).toBeDefined();
      if (code === undefined) {
        throw new Error('Fixture de ingresso não foi criada.');
      }

      expect(() =>
        deleteTicketCode(database, { codeId: code.id, reason: 'Excluir código' }),
      ).toThrow('Cancele o ingresso antes de excluir definitivamente o código.');
      cancelTicketCode(database, { codeId: code.id, reason: 'Ingresso duplicado' });
      expect(
        deleteTicketCode(database, { codeId: code.id, reason: 'Limpar código duplicado' }),
      ).toEqual({
        success: true,
      });
      const updatedSale = getTicketState(database).sales.find((item) => item.id === sale.id);
      expect(updatedSale?.codes).toHaveLength(1);
      expect(updatedSale?.quantity).toBe(1);
    } finally {
      database.close();
    }
  });
});
