import { describe, expect, it } from 'vitest';

import type { DatabaseReceiptDocument, DatabaseReceiptSettings } from '@gtrz/database';

import { buildReceiptHtml } from './receipt-template';

const settings: DatabaseReceiptSettings = {
  autoPrint: true,
  printerName: null,
  paperWidthMm: 58,
};

const document: DatabaseReceiptDocument = {
  orderId: '11111111-1111-4111-8111-111111111111',
  eventId: '22222222-2222-4222-8222-222222222222',
  eventName: 'La Rumba & Neon',
  servicePointLabel: 'Mesa 12',
  closedAt: new Date('2026-08-08T03:00:00-03:00').getTime(),
  items: [
    {
      name: 'Coca-Cola <Lata>',
      quantity: 2,
      unitPriceCents: 1000,
      totalCents: 2000,
    },
  ],
  totalCents: 2000,
  payments: [
    {
      method: 'cash',
      amountCents: 2000,
      receivedCents: 5000,
      changeCents: 3000,
    },
  ],
  voucherUses: [],
  totalChangeCents: 3000,
};

describe('thermal receipt template', () => {
  it('inclui evento, itens, pagamento, troco e aviso de validade', () => {
    const html = buildReceiptHtml(document, settings);

    expect(html).toContain('La Rumba &amp; Neon');
    expect(html).toContain('2x Coca-Cola &lt;Lata&gt;');
    expect(html).toContain('Dinheiro');
    expect(html).toContain('Recebido');
    expect(html).toContain('TROCO');
    expect(html).toContain('R$ 30,00');
    expect(html).toContain('APRESENTE ESTA NOTA NO BAR PARA RETIRAR OS ITENS');
    expect(html).toContain('Esta nota é válida somente durante o evento');
    expect(html).toContain('VENDA 11111111');
    expect(html).toContain('58mm');
  });
});
