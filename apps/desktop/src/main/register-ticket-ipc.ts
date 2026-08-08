import { ipcMain } from 'electron';

import {
  cancelTicketCodeInputSchema,
  cancelTicketSaleInputSchema,
  createTicketLotInputSchema,
  createTicketSaleInputSchema,
  deleteTicketCodeInputSchema,
  deleteTicketLotInputSchema,
  deleteTicketSaleInputSchema,
  IPC_CHANNELS,
  ticketDeleteResultSchema,
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
  deleteTicketCode,
  deleteTicketLot,
  deleteTicketSale,
  getTicketState,
  updateTicketLot,
  type DatabaseContext,
} from '@gtrz/database';

import { handleIpc } from './ipc-handler';

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
  IPC_CHANNELS.ticketsDeleteLot,
  IPC_CHANNELS.ticketsDeleteSale,
  IPC_CHANNELS.ticketsDeleteCode,
] as const;

export function registerTicketIpcHandlers(options: RegisterTicketIpcOptions): void {
  for (const channel of TICKET_CHANNELS) {
    ipcMain.removeHandler(channel);
  }

  handleIpc(IPC_CHANNELS.ticketsGetState, () => {
    return ticketStateSchema.parse(getTicketState(options.getDatabase()));
  });

  handleIpc(IPC_CHANNELS.ticketsCreateLot, (_event, payload: unknown) => {
    const input = createTicketLotInputSchema.parse(payload);
    return ticketLotSchema.parse(createTicketLot(options.getDatabase(), input));
  });

  handleIpc(IPC_CHANNELS.ticketsUpdateLot, (_event, payload: unknown) => {
    const input = updateTicketLotInputSchema.parse(payload);
    return ticketLotSchema.parse(updateTicketLot(options.getDatabase(), input));
  });

  handleIpc(IPC_CHANNELS.ticketsCreateSale, (_event, payload: unknown) => {
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

  handleIpc(IPC_CHANNELS.ticketsCancelSale, (_event, payload: unknown) => {
    const input = cancelTicketSaleInputSchema.parse(payload);
    return ticketSaleSchema.parse(cancelTicketSale(options.getDatabase(), input));
  });

  handleIpc(IPC_CHANNELS.ticketsCancelCode, (_event, payload: unknown) => {
    const input = cancelTicketCodeInputSchema.parse(payload);
    return ticketSaleSchema.parse(cancelTicketCode(options.getDatabase(), input));
  });

  handleIpc(IPC_CHANNELS.ticketsDeleteLot, (_event, payload: unknown) => {
    const input = deleteTicketLotInputSchema.parse(payload);
    return ticketDeleteResultSchema.parse(deleteTicketLot(options.getDatabase(), input));
  });

  handleIpc(IPC_CHANNELS.ticketsDeleteSale, (_event, payload: unknown) => {
    const input = deleteTicketSaleInputSchema.parse(payload);
    return ticketDeleteResultSchema.parse(deleteTicketSale(options.getDatabase(), input));
  });

  handleIpc(IPC_CHANNELS.ticketsDeleteCode, (_event, payload: unknown) => {
    const input = deleteTicketCodeInputSchema.parse(payload);
    return ticketDeleteResultSchema.parse(deleteTicketCode(options.getDatabase(), input));
  });
}
