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
  type CancelTicketCodeInput,
  type CancelTicketSaleInput,
  type CreateTicketLotInput,
  type CreateTicketSaleInput,
  type TicketApi,
  type TicketLot,
  type TicketSale,
  type TicketState,
  type UpdateTicketLotInput,
} from '@gtrz/contracts';

import { typedIpcRenderer as ipcRenderer } from './invoke-ipc';

export const ticketApi: TicketApi = {
  async getState(): Promise<TicketState> {
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.ticketsGetState);
    return ticketStateSchema.parse(payload);
  },

  async createLot(input: CreateTicketLotInput): Promise<TicketLot> {
    const parsedInput = createTicketLotInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.ticketsCreateLot, parsedInput);
    return ticketLotSchema.parse(payload);
  },

  async updateLot(input: UpdateTicketLotInput): Promise<TicketLot> {
    const parsedInput = updateTicketLotInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.ticketsUpdateLot, parsedInput);
    return ticketLotSchema.parse(payload);
  },

  async createSale(input: CreateTicketSaleInput): Promise<TicketSale> {
    const parsedInput = createTicketSaleInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.ticketsCreateSale, parsedInput);
    return ticketSaleSchema.parse(payload);
  },

  async cancelSale(input: CancelTicketSaleInput): Promise<TicketSale> {
    const parsedInput = cancelTicketSaleInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.ticketsCancelSale, parsedInput);
    return ticketSaleSchema.parse(payload);
  },

  async cancelCode(input: CancelTicketCodeInput): Promise<TicketSale> {
    const parsedInput = cancelTicketCodeInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.ticketsCancelCode, parsedInput);
    return ticketSaleSchema.parse(payload);
  },
};
