import { ipcMain } from 'electron';

import {
  cancelTicketCodeInputSchema,
  cancelTicketSaleInputSchema,
  createTicketLotInputSchema,
  createTicketSaleInputSchema,
  IPC_CHANNELS,
  ticketLotSchema,
  ticketSaleSchema,
  ticketStateSchema,
  updateTicketLotInputSchema,
} from '@gtrz/contracts';
import {
  cancelTicketCode,
  cancelTicketSale,
  createTicketLot,
  createTicketSale,
  getTicketState,
  updateTicketLot,
  type DatabaseContext,
} from '@gtrz/database';

interface RegisterTicketIpcOptions {
  readonly getDatabase: () => DatabaseContext;
}

const TICKET_CHANNELS = [
  IPC_CHANNELS.ticketsGetState,
  IPC_CHANNELS.ticketsCreateLot,
  IPC_CHANNELS.ticketsUpdateLot,
  IPC_CHANNELS.ticketsCreateSale,
  IPC_CHANNELS.ticketsCancelSale,
  IPC_CHANNELS.ticketsCancelCode,
] as const;

export function registerTicketIpcHandlers(options: RegisterTicketIpcOptions): void {
  for (const channel of TICKET_CHANNELS) {
    ipcMain.removeHandler(channel);
  }

  ipcMain.handle(IPC_CHANNELS.ticketsGetState, () => {
    return ticketStateSchema.parse(getTicketState(options.getDatabase()));
  });

  ipcMain.handle(IPC_CHANNELS.ticketsCreateLot, (_event, payload: unknown) => {
    const input = createTicketLotInputSchema.parse(payload);
    return ticketLotSchema.parse(createTicketLot(options.getDatabase(), input));
  });

  ipcMain.handle(IPC_CHANNELS.ticketsUpdateLot, (_event, payload: unknown) => {
    const input = updateTicketLotInputSchema.parse(payload);
    return ticketLotSchema.parse(updateTicketLot(options.getDatabase(), input));
  });

  ipcMain.handle(IPC_CHANNELS.ticketsCreateSale, (_event, payload: unknown) => {
    const input = createTicketSaleInputSchema.parse(payload);
    const databaseInput = {
      lotId: input.lotId,
      attendeeName: input.attendeeName,
      source: input.source,
      quantity: input.quantity,
      ...(input.paymentMethod === undefined ? {} : { paymentMethod: input.paymentMethod }),
      ...(input.manualCodes === undefined ? {} : { manualCodes: input.manualCodes }),
    };
    return ticketSaleSchema.parse(createTicketSale(options.getDatabase(), databaseInput));
  });

  ipcMain.handle(IPC_CHANNELS.ticketsCancelSale, (_event, payload: unknown) => {
    const input = cancelTicketSaleInputSchema.parse(payload);
    return ticketSaleSchema.parse(cancelTicketSale(options.getDatabase(), input));
  });

  ipcMain.handle(IPC_CHANNELS.ticketsCancelCode, (_event, payload: unknown) => {
    const input = cancelTicketCodeInputSchema.parse(payload);
    return ticketSaleSchema.parse(cancelTicketCode(options.getDatabase(), input));
  });
}
