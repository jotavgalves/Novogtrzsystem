import { ipcMain } from 'electron';

import {
  IPC_CHANNELS,
  printReceiptInputSchema,
  receiptPrinterListSchema,
  receiptPrintResultSchema,
  receiptSettingsSchema,
  updateReceiptSettingsInputSchema,
} from '@gtrz/contracts';
import { getReceiptSettings, type DatabaseContext, updateReceiptSettings } from '@gtrz/database';

import { handleIpc } from './ipc-handler';
import type { ReceiptPrinterService } from './receipt-printer-service';

interface RegisterReceiptIpcOptions {
  readonly getDatabase: () => DatabaseContext;
  readonly receiptPrinter: ReceiptPrinterService;
}

const RECEIPT_CHANNELS = [
  IPC_CHANNELS.receiptsGetSettings,
  IPC_CHANNELS.receiptsUpdateSettings,
  IPC_CHANNELS.receiptsListPrinters,
  IPC_CHANNELS.receiptsPrintOrder,
] as const;

export function registerReceiptIpcHandlers(options: RegisterReceiptIpcOptions): void {
  for (const channel of RECEIPT_CHANNELS) {
    ipcMain.removeHandler(channel);
  }

  handleIpc(IPC_CHANNELS.receiptsGetSettings, () => {
    return receiptSettingsSchema.parse(getReceiptSettings(options.getDatabase()));
  });

  handleIpc(IPC_CHANNELS.receiptsUpdateSettings, (_event, payload: unknown) => {
    const input = updateReceiptSettingsInputSchema.parse(payload);
    return receiptSettingsSchema.parse(updateReceiptSettings(options.getDatabase(), input));
  });

  handleIpc(IPC_CHANNELS.receiptsListPrinters, async () => {
    return receiptPrinterListSchema.parse(await options.receiptPrinter.listPrinters());
  });

  handleIpc(IPC_CHANNELS.receiptsPrintOrder, async (_event, payload: unknown) => {
    const input = printReceiptInputSchema.parse(payload);
    return receiptPrintResultSchema.parse(await options.receiptPrinter.printOrder(input.orderId));
  });
}
