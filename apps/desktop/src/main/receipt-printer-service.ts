import { BrowserWindow, type PrinterInfo } from 'electron';

import type { ReceiptPrintResult, ReceiptPrinter } from '@gtrz/contracts';
import { getReceiptDocument, getReceiptSettings, type DatabaseContext } from '@gtrz/database';

import { buildReceiptHtml } from './receipt-template';

interface ReceiptPrinterServiceOptions {
  readonly getDatabase: () => DatabaseContext;
}

function normalizePrinter(printer: PrinterInfo): ReceiptPrinter {
  return {
    name: printer.name,
    displayName: printer.displayName || printer.name,
    isDefault: printer.isDefault,
  };
}

export class ReceiptPrinterService {
  private readonly getDatabase: () => DatabaseContext;

  constructor(options: ReceiptPrinterServiceOptions) {
    this.getDatabase = options.getDatabase;
  }

  async listPrinters(): Promise<readonly ReceiptPrinter[]> {
    const sourceWindow = BrowserWindow.getAllWindows()[0];

    if (sourceWindow === undefined || sourceWindow.isDestroyed()) {
      return [];
    }

    const printers = await sourceWindow.webContents.getPrintersAsync();
    return printers.map(normalizePrinter).sort((left, right) => {
      if (left.isDefault !== right.isDefault) {
        return left.isDefault ? -1 : 1;
      }
      return left.displayName.localeCompare(right.displayName, 'pt-BR');
    });
  }

  async printOrder(orderId: string, automatic = false): Promise<ReceiptPrintResult> {
    const database = this.getDatabase();
    const settings = getReceiptSettings(database);

    if (automatic && !settings.autoPrint) {
      return { status: 'skipped', printerName: null, message: 'Impressão automática desativada.' };
    }

    try {
      const printers = await this.listPrinters();
      const printer =
        settings.printerName === null
          ? (printers.find((item) => item.isDefault) ?? printers[0])
          : printers.find((item) => item.name === settings.printerName);

      if (printer === undefined) {
        return {
          status: 'unavailable',
          printerName: settings.printerName,
          message:
            settings.printerName === null
              ? 'Nenhuma impressora disponível no Windows.'
              : 'A impressora térmica configurada não está disponível.',
        };
      }

      const document = getReceiptDocument(database, orderId);
      const html = buildReceiptHtml(document, settings);
      const printWindow = new BrowserWindow({
        show: false,
        width: settings.paperWidthMm === 80 ? 520 : 380,
        height: 900,
        webPreferences: {
          sandbox: true,
        },
      });

      try {
        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        const result = await new Promise<ReceiptPrintResult>((resolve) => {
          printWindow.webContents.print(
            {
              silent: true,
              printBackground: true,
              deviceName: printer.name,
              margins: { marginType: 'none' },
            },
            (success, failureReason) => {
              resolve(
                success
                  ? { status: 'printed', printerName: printer.name, message: null }
                  : {
                      status: 'failed',
                      printerName: printer.name,
                      message: failureReason || 'O Windows não confirmou a impressão.',
                    },
              );
            },
          );
        });
        return result;
      } finally {
        if (!printWindow.isDestroyed()) {
          printWindow.destroy();
        }
      }
    } catch (error: unknown) {
      return {
        status: 'failed',
        printerName: settings.printerName,
        message: error instanceof Error ? error.message : 'Falha desconhecida ao imprimir a nota.',
      };
    }
  }
}
