import { ipcRenderer } from 'electron';

import { ipcResponseSchema } from '@gtrz/contracts';

interface PayloadParser<T> {
  parse(value: unknown): T;
}

export async function invokeIpc<T>(
  channel: string,
  responseSchema: PayloadParser<T>,
  payload?: unknown,
): Promise<T> {
  const rawResponse: unknown =
    payload === undefined
      ? await ipcRenderer.invoke(channel)
      : await ipcRenderer.invoke(channel, payload);
  const response = ipcResponseSchema.parse(rawResponse);

  if (!response.ok) {
    throw response.error;
  }

  return responseSchema.parse(response.data);
}
