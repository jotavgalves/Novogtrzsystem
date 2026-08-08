import { describe, expect, it } from 'vitest';

import {
  backupRecordSchema,
  backupStateSchema,
  createEventInputSchema,
  createVoucherInputSchema,
  deleteEventInputSchema,
  eventSchema,
  restoreBackupResultSchema,
  sessionStateSchema,
  setOrderItemQuantityInputSchema,
  switchProfileInputSchema,
  systemInfoSchema,
} from './index';

describe('systemInfoSchema', () => {
  it('aceita um estado válido do aplicativo', () => {
    const result = systemInfoSchema.parse({
      appName: 'GTRZ System',
      version: '0.1.0',
      platform: 'win32',
      databaseReady: true,
    });

    expect(result.databaseReady).toBe(true);
  });

  it('rejeita plataformas e estruturas não previstas', () => {
    expect(() =>
      systemInfoSchema.parse({
        appName: 'GTRZ System',
        version: '0.1.0',
        platform: 'android',
        databaseReady: true,
      }),
    ).toThrow();
  });
});

describe('control contracts', () => {
  const event = {
    id: '85ffbb3f-6d4c-43d3-b615-e437fd5d88f4',
    name: 'La Rumba Neon',
    status: 'open',
    startsAt: 1_786_000_000_000,
    endsAt: null,
    createdAt: 1_785_000_000_000,
    updatedAt: 1_785_000_000_000,
  } as const;

  it('normaliza o nome e valida os dados mínimos do evento', () => {
    expect(
      createEventInputSchema.parse({ name: '  Evento GTRZ  ', startsAt: event.startsAt }),
    ).toEqual({ name: 'Evento GTRZ', startsAt: event.startsAt });
    expect(eventSchema.parse(event)).toEqual(event);
    expect(deleteEventInputSchema.parse({ eventId: event.id })).toEqual({ eventId: event.id });
  });

  it('aceita sessão Produção com evento ativo', () => {
    expect(sessionStateSchema.parse({ profile: 'production', activeEvent: event })).toEqual({
      profile: 'production',
      activeEvent: event,
    });
  });

  it('aceita mudança para Caixa sem senha e limita senha informada', () => {
    expect(switchProfileInputSchema.parse({ targetProfile: 'cashier' })).toEqual({
      targetProfile: 'cashier',
    });
    expect(() =>
      switchProfileInputSchema.parse({ targetProfile: 'production', password: 'x'.repeat(129) }),
    ).toThrow();
  });
});

describe('operational contracts', () => {
  const orderId = 'd93e52dd-74ae-4b1d-a600-d95193336a9c';
  const orderItemId = '78006af6-7f90-4df7-8fc2-60f6e2288e31';
  const servicePointId = 'a59108b2-fcad-4a53-989b-e9c2c31b599c';

  it('aceita quantidade positiva digitada diretamente no carrinho', () => {
    expect(setOrderItemQuantityInputSchema.parse({ orderId, orderItemId, quantity: 12 })).toEqual({
      orderId,
      orderItemId,
      quantity: 12,
    });
    expect(() =>
      setOrderItemQuantityInputSchema.parse({ orderId, orderItemId, quantity: 0 }),
    ).toThrow();
  });

  it('exige uma mesa ao emitir voucher pela API do aplicativo', () => {
    expect(
      createVoucherInputSchema.parse({
        code: 'MESA-001',
        label: 'Crédito da mesa',
        linkedServicePointId: servicePointId,
        initialBalanceCents: 1000,
      }),
    ).toMatchObject({ linkedServicePointId: servicePointId });
    expect(() =>
      createVoucherInputSchema.parse({
        code: 'SEM-MESA',
        label: 'Voucher inválido',
        initialBalanceCents: 1000,
      }),
    ).toThrow();
  });
});

describe('backup contracts', () => {
  const record = {
    fileName: 'GTRZ-2026-08-05-manual.gtrzbackup',
    filePath: 'D:/Backups/GTRZ-2026-08-05-manual.gtrzbackup',
    kind: 'manual',
    createdAt: 1_786_000_000_000,
    sizeBytes: 2048,
    integrity: 'valid',
  } as const;

  it('aceita pacote íntegro e estado com destino configurado', () => {
    expect(backupRecordSchema.parse(record)).toEqual(record);
    expect(backupStateSchema.parse({ destinationPath: 'D:/Backups', backups: [record] })).toEqual({
      destinationPath: 'D:/Backups',
      backups: [record],
    });
  });

  it('diferencia importação cancelada de restauração concluída', () => {
    expect(restoreBackupResultSchema.parse({ status: 'cancelled' })).toEqual({
      status: 'cancelled',
    });
    expect(
      restoreBackupResultSchema.parse({
        status: 'restored',
        sourceFileName: record.fileName,
        restoredAt: record.createdAt,
      }),
    ).toMatchObject({ status: 'restored', sourceFileName: record.fileName });
  });
});
