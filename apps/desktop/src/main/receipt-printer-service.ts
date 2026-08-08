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
    return printers
      .map(normalizePrinter)
      .sort((left, right) => left.displayName.localeCompare(right.displayName, 'pt-BR'));
  }

  async printOrder(orderId: string, automatic = false): Promise<ReceiptPrintResult> {
    const database = this.getDatabase();
    const settings = getReceiptSettings(database);

    if (automatic && !settings.autoPrint) {
      return { status: 'skipped', printerName: null, message: 'Impressão automática desativada.' };
    }

    try {
      const printers = await this.listPrinters();
      const configuredPrinter =
        settings.printerName === null
          ? null
          : printers.find((item) => item.name === settings.printerName);

      if (settings.printerName !== null && configuredPrinter === undefined) {
        return {
          status: 'unavailable',
          printerName: settings.printerName,
          message: 'A impressora térmica configurada não está disponível.',
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
              ...(configuredPrinter === null ? {} : { deviceName: configuredPrinter.name }),
              margins: { marginType: 'none' },
            },
            (success, failureReason) => {
              resolve(
                success
                  ? {
                      status: 'printed',
                      printerName: configuredPrinter?.name ?? null,
                      message: null,
                    }
                  : {
                      status: 'failed',
                      printerName: configuredPrinter?.name ?? null,
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
