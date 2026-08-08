import { describe, expect, it } from 'vitest';

import {
  printReceiptInputSchema,
  receiptPrintResultSchema,
  receiptSettingsSchema,
} from './receipts';

describe('receipt contracts', () => {
  it('valida configuracao, pedido de impressao e resultado', () => {
    expect(
      receiptSettingsSchema.parse({
        autoPrint: true,
        printerName: 'THERMAL-01',
        paperWidthMm: 58,
      }),
    ).toMatchObject({ autoPrint: true, paperWidthMm: 58 });
    expect(
      printReceiptInputSchema.parse({ orderId: '11111111-1111-4111-8111-111111111111' }),
    ).toEqual({ orderId: '11111111-1111-4111-8111-111111111111' });
    expect(
      receiptPrintResultSchema.parse({
        status: 'printed',
        printerName: 'THERMAL-01',
        message: null,
      }),
    ).toMatchObject({ status: 'printed' });
  });

  it('rejeita largura de papel nao suportada', () => {
    expect(() =>
      receiptSettingsSchema.parse({
        autoPrint: false,
        printerName: null,
        paperWidthMm: 76,
      }),
    ).toThrow();
  });
});
