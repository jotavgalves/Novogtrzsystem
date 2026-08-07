import { ipcMain, type IpcMainInvokeEvent } from 'electron';

import type { AppErrorPayload, IpcResponse } from '@gtrz/contracts';
import { isDatabaseError } from '@gtrz/database/errors';

interface StructuredError extends Error {
  readonly code?: string;
  readonly issues?: readonly unknown[];
}

type IpcListener = (event: IpcMainInvokeEvent, payload: unknown) => unknown | Promise<unknown>;

function errorCode(error: Error): string | null {
  return (error as StructuredError).code ?? null;
}

function isValidationError(error: Error): error is StructuredError {
  return error.name === 'ZodError' && Array.isArray((error as StructuredError).issues);
}

export function toAppErrorPayload(error: unknown): AppErrorPayload {
  if (isDatabaseError(error)) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  if (!(error instanceof Error)) {
    return {
      code: 'UNEXPECTED_ERROR',
      message: 'Não foi possível concluir a operação.',
      details: null,
    };
  }

  if (isValidationError(error)) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Os dados informados não são válidos.',
      details: { issues: error.issues ?? [] },
    };
  }

  const code = errorCode(error);

  if (code?.startsWith('SQLITE_') === true) {
    return {
      code: 'INTEGRITY_ERROR',
      message: 'O banco local rejeitou a operação por uma regra de integridade.',
      details: { databaseCode: code },
    };
  }

  if (code?.startsWith('E') === true) {
    return {
      code: 'IO_ERROR',
      message: error.message,
      details: { systemCode: code },
    };
  }

  return {
    code: 'UNEXPECTED_ERROR',
    message: error.message || 'Não foi possível concluir a operação.',
    details: { errorName: error.name },
  };
}

export function handleIpc(channel: string, listener: IpcListener): void {
  ipcMain.handle(channel, async (event, payload: unknown): Promise<IpcResponse> => {
    try {
      return { ok: true, data: await listener(event, payload) };
    } catch (error: unknown) {
      return { ok: false, error: toAppErrorPayload(error) };
    }
  });
}
