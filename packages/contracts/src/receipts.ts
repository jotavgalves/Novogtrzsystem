import { z } from 'zod';

export const receiptSettingsSchema = z.object({
  autoPrint: z.boolean(),
  printerName: z.string().min(1).nullable(),
  paperWidthMm: z.union([z.literal(58), z.literal(80)]),
});

export const updateReceiptSettingsInputSchema = receiptSettingsSchema;

export const receiptPrinterSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  isDefault: z.boolean(),
});

export const receiptPrinterListSchema = z.array(receiptPrinterSchema);

export const printReceiptInputSchema = z.object({
  orderId: z.uuid(),
});

export const receiptPrintResultSchema = z.object({
  status: z.enum(['printed', 'skipped', 'unavailable', 'failed']),
  printerName: z.string().nullable(),
  message: z.string().nullable(),
});

export type ReceiptSettings = z.infer<typeof receiptSettingsSchema>;
export type UpdateReceiptSettingsInput = z.infer<typeof updateReceiptSettingsInputSchema>;
export type ReceiptPrinter = z.infer<typeof receiptPrinterSchema>;
export type PrintReceiptInput = z.infer<typeof printReceiptInputSchema>;
export type ReceiptPrintResult = z.infer<typeof receiptPrintResultSchema>;

export interface ReceiptApi {
  getSettings(): Promise<ReceiptSettings>;
  updateSettings(input: UpdateReceiptSettingsInput): Promise<ReceiptSettings>;
  listPrinters(): Promise<readonly ReceiptPrinter[]>;
  printOrder(input: PrintReceiptInput): Promise<ReceiptPrintResult>;
}
