import { ipcRenderer } from 'electron';

import { ipcResponseSchema, type AppErrorPayload } from '@gtrz/contracts';

interface PayloadParser<T> {
  parse(value: unknown): T;
}

class IpcClientError extends Error {
  readonly code: AppErrorPayload['code'];
  readonly details: AppErrorPayload['details'];

  constructor(payload: AppErrorPayload) {
    super(payload.message);
    this.name = 'IpcClientError';
    this.code = payload.code;
    this.details = payload.details;
  }
}

async function invokeEnvelope(channel: string, payload?: unknown): Promise<unknown> {
  const rawResponse: unknown =
    payload === undefined
      ? await ipcRenderer.invoke(channel)
      : await ipcRenderer.invoke(channel, payload);
  const response = ipcResponseSchema.parse(rawResponse);

  if (!response.ok) {
    throw new IpcClientError(response.error);
  }

  return response.data;
}

export const typedIpcRenderer = {
  invoke(channel: string, payload?: unknown): Promise<unknown> {
    return invokeEnvelope(channel, payload);
  },
};

export async function invokeIpc<T>(
  channel: string,
  responseSchema: PayloadParser<T>,
  payload?: unknown,
): Promise<T> {
  return responseSchema.parse(await typedIpcRenderer.invoke(channel, payload));
}
