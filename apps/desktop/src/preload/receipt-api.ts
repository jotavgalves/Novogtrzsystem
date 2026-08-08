import {
  IPC_CHANNELS,
  printReceiptInputSchema,
  receiptPrinterListSchema,
  receiptPrintResultSchema,
  receiptSettingsSchema,
  type PrintReceiptInput,
  type ReceiptApi,
  type ReceiptPrinter,
  type ReceiptPrintResult,
  type ReceiptSettings,
} from '@gtrz/contracts';

import { typedIpcRenderer as ipcRenderer } from './invoke-ipc';

export const receiptApi: ReceiptApi = {
  async getSettings(): Promise<ReceiptSettings> {
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.receiptsGetSettings);
    return receiptSettingsSchema.parse(payload);
  },

  async updateSettings(input: ReceiptSettings): Promise<ReceiptSettings> {
    const parsedInput = receiptSettingsSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.receiptsUpdateSettings,
      parsedInput,
    );
    return receiptSettingsSchema.parse(payload);
  },

  async listPrinters(): Promise<readonly ReceiptPrinter[]> {
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.receiptsListPrinters);
    return receiptPrinterListSchema.parse(payload);
  },

  async printOrder(input: PrintReceiptInput): Promise<ReceiptPrintResult> {
    const parsedInput = printReceiptInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.receiptsPrintOrder, parsedInput);
    return receiptPrintResultSchema.parse(payload);
  },
};
