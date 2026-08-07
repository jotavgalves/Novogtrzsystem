import { describe, expect, it } from 'vitest';

import { stockTransferSchema, transferStockInputSchema } from './inventory';

const sourceEventId = '85ffbb3f-6d4c-43d3-b615-e437fd5d88f4';
const destinationEventId = '725a7e97-e95f-4557-a020-d485eba6b3a1';
const productId = 'd3b6e421-a873-4713-a2ff-e5439a84b948';

describe('stock transfer contracts', () => {
  it('normaliza observação e aceita eventos diferentes', () => {
    expect(
      transferStockInputSchema.parse({
        sourceEventId,
        destinationEventId,
        productId,
        quantity: 5,
        note: '  saldo remanescente  ',
      }),
    ).toEqual({
      sourceEventId,
      destinationEventId,
      productId,
      quantity: 5,
      note: 'saldo remanescente',
    });
  });

  it('rejeita origem e destino iguais', () => {
    expect(() =>
      transferStockInputSchema.parse({
        sourceEventId,
        destinationEventId: sourceEventId,
        productId,
        quantity: 1,
      }),
    ).toThrow('Os eventos de origem e destino devem ser diferentes.');
  });

  it('aceita o registro imutável com saldos antes e depois', () => {
    expect(
      stockTransferSchema.parse({
        id: '0b7e8a1a-843f-4eb4-858f-e8d84693ca04',
        productId,
        productName: 'Budweiser lata',
        sourceEventId,
        sourceEventName: 'Evento origem',
        destinationEventId,
        destinationEventName: 'Evento destino',
        quantity: 5,
        note: null,
        sourceQuantityBefore: 10,
        sourceQuantityAfter: 5,
        destinationQuantityBefore: 2,
        destinationQuantityAfter: 7,
        createdAt: 1_786_000_000_000,
      }),
    ).toMatchObject({
      quantity: 5,
      sourceQuantityAfter: 5,
      destinationQuantityAfter: 7,
    });
  });
});
