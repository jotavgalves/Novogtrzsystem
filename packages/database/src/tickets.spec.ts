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
  getCashState,
  getTicketState,
  openDatabase,
  switchProfile,
  updateTicketLot,
  type DatabaseContext,
} from './index';

let temporaryDirectory: string | null = null;

async function createTemporaryDatabase(): Promise<DatabaseContext> {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-tickets-'));
  return openDatabase(path.join(temporaryDirectory, 'tickets.sqlite'));
}

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

describe('tickets database', () => {
  it('registra venda em grupo com códigos únicos e integra a receita ao caixa', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento ingressos', startsAt: Date.now() });
    const lot = createTicketLot(database, {
      name: 'Primeiro lote',
      priceCents: 5000,
      capacity: 10,
    });
    const sale = createTicketSale(database, {
      lotId: lot.id,
      attendeeName: 'João da Silva',
      source: 'door',
      quantity: 3,
      paymentMethod: 'cash',
    });

    expect(sale).toMatchObject({
      lotName: 'Primeiro lote',
      quantity: 3,
      unitPriceCents: 5000,
      totalCents: 15000,
      paymentMethod: 'cash',
      status: 'active',
    });
    expect(sale.codes).toHaveLength(3);
    expect(new Set(sale.codes.map((code) => code.code)).size).toBe(3);
    expect(getTicketState(database).lots[0]).toMatchObject({
      soldQuantity: 3,
      courtesyQuantity: 0,
      availableQuantity: 7,
    });
    expect(getCashState(database).salesByMethod.cashCents).toBe(15000);
    expect(getCashState(database).grossSalesCents).toBe(15000);
    database.close();
  });

  it('registra cortesia sem receita e consome capacidade', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento cortesia', startsAt: Date.now() });
    const lot = createTicketLot(database, {
      name: 'Lote cortesia',
      priceCents: 6000,
      capacity: 5,
    });
    const sale = createTicketSale(database, {
      lotId: lot.id,
      attendeeName: 'Convidados especiais',
      source: 'courtesy',
      quantity: 2,
      manualCodes: ['VIP-001', 'VIP-002'],
    });

    expect(sale).toMatchObject({ totalCents: 0, paymentMethod: null, source: 'courtesy' });
    expect(sale.codes.map((code) => code.code)).toEqual(['VIP-001', 'VIP-002']);
    expect(getTicketState(database).lots[0]).toMatchObject({
      soldQuantity: 0,
      courtesyQuantity: 2,
      availableQuantity: 3,
    });
    expect(getCashState(database).grossSalesCents).toBe(0);
    database.close();
  });

  it('cancela venda, invalida códigos e devolve capacidade e receita', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento cancelamento de ingresso', startsAt: Date.now() });
    const lot = createTicketLot(database, {
      name: 'Lote cancelável',
      priceCents: 4000,
      capacity: 4,
    });
    const sale = createTicketSale(database, {
      lotId: lot.id,
      attendeeName: 'Compra duplicada',
      source: 'whatsapp',
      quantity: 2,
      paymentMethod: 'pix',
    });
    const cancelled = cancelTicketSale(database, {
      saleId: sale.id,
      reason: 'Pagamento duplicado',
    });

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.codes.every((code) => code.status === 'cancelled')).toBe(true);
    expect(getTicketState(database).lots[0]?.availableQuantity).toBe(4);
    expect(getTicketState(database).activeRevenueCents).toBe(0);
    expect(getCashState(database).salesByMethod.pixCents).toBe(0);
    expect(() =>
      cancelTicketSale(database, { saleId: sale.id, reason: 'Segundo cancelamento' }),
    ).toThrow('Esta venda de ingresso já foi cancelada.');
    database.close();
  });

  it('cancela ingresso individual de venda múltipla e mantém os demais válidos', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento cancelamento individual', startsAt: Date.now() });
    const lot = createTicketLot(database, {
      name: 'Lote individual',
      priceCents: 2500,
      capacity: 5,
    });
    const sale = createTicketSale(database, {
      lotId: lot.id,
      attendeeName: 'Grupo parcial',
      source: 'door',
      quantity: 3,
      paymentMethod: 'cash',
      manualCodes: ['IND-001', 'IND-002', 'IND-003'],
    });

    const partiallyCancelled = cancelTicketCode(database, {
      codeId: sale.codes[0]?.id ?? '',
      reason: 'Pessoa desistiu',
    });

    expect(partiallyCancelled).toMatchObject({
      status: 'active',
      quantity: 2,
      totalCents: 5000,
    });
    expect(partiallyCancelled.codes.filter((code) => code.status === 'valid')).toHaveLength(2);
    expect(getTicketState(database).lots[0]).toMatchObject({
      soldQuantity: 2,
      availableQuantity: 3,
    });
    expect(getCashState(database).salesByMethod.cashCents).toBe(5000);

    const lastValidCodes = partiallyCancelled.codes.filter((code) => code.status === 'valid');
    cancelTicketCode(database, { codeId: lastValidCodes[0]?.id ?? '', reason: 'Cancelado' });
    const fullyCancelled = cancelTicketCode(database, {
      codeId: lastValidCodes[1]?.id ?? '',
      reason: 'Cancelado',
    });

    expect(fullyCancelled.status).toBe('cancelled');
    expect(fullyCancelled.codes.every((code) => code.status === 'cancelled')).toBe(true);
    expect(getTicketState(database).lots[0]?.availableQuantity).toBe(5);
    expect(getCashState(database).grossSalesCents).toBe(0);
    expect(() =>
      cancelTicketCode(database, { codeId: sale.codes[0]?.id ?? '', reason: 'Duplicado' }),
    ).toThrow('Este ingresso já foi cancelado.');
    database.close();
  });

  it('bloqueia excesso de capacidade, códigos duplicados e redução abaixo do consumo', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento limites', startsAt: Date.now() });
    const lot = createTicketLot(database, {
      name: 'Lote limitado',
      priceCents: 3000,
      capacity: 2,
    });
    createTicketSale(database, {
      lotId: lot.id,
      attendeeName: 'Primeiro comprador',
      source: 'sympla',
      quantity: 1,
      paymentMethod: 'credit-card',
      manualCodes: ['CODIGO-01'],
    });

    expect(() =>
      createTicketSale(database, {
        lotId: lot.id,
        attendeeName: 'Código repetido',
        source: 'door',
        quantity: 1,
        paymentMethod: 'cash',
        manualCodes: ['CODIGO-01'],
      }),
    ).toThrow('O código CODIGO-01 já foi utilizado neste evento.');
    expect(() =>
      createTicketSale(database, {
        lotId: lot.id,
        attendeeName: 'Excesso',
        source: 'door',
        quantity: 2,
        paymentMethod: 'cash',
      }),
    ).toThrow('Capacidade insuficiente. Disponível: 1.');
    expect(() =>
      updateTicketLot(database, {
        lotId: lot.id,
        name: lot.name,
        priceCents: lot.priceCents,
        capacity: 0,
        active: true,
      }),
    ).toThrow('A capacidade não pode ser menor que os 1 ingressos ativos.');
    database.close();
  });

  it('restringe administração de ingressos no perfil Caixa', async () => {
    const database = await createTemporaryDatabase();
    createEvent(database, { name: 'Evento ingresso Caixa', startsAt: Date.now() });
    switchProfile(database, 'cashier');

    expect(() =>
      createTicketLot(database, { name: 'Lote proibido', priceCents: 1000, capacity: 10 }),
    ).toThrow('A administração de ingressos exige o perfil Produção.');
    database.close();
  });
});
