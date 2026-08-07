import { ipcRenderer } from 'electron';

import {
  completeEventCloseInputSchema,
  eventClosePreviewInputSchema,
  eventCloseResultSchema,
  eventCloseSummarySchema,
  IPC_CHANNELS,
  type CompleteEventCloseInput,
  type EventCloseApi,
  type EventClosePreviewInput,
  type EventCloseResult,
  type EventCloseSummary,
} from '@gtrz/contracts';

export const eventCloseApi: EventCloseApi = {
  async preview(input: EventClosePreviewInput): Promise<EventCloseSummary> {
    const parsedInput = eventClosePreviewInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.eventClosePreview, parsedInput);
    return eventCloseSummarySchema.parse(payload);
  },
  async complete(input: CompleteEventCloseInput): Promise<EventCloseResult> {
    const parsedInput = completeEventCloseInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.eventCloseComplete, parsedInput);
    return eventCloseResultSchema.parse(payload);
  },
};
