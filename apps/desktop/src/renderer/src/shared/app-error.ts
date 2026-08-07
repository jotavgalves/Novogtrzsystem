import {
  appErrorPayloadSchema,
  type AppErrorCode,
  type AppErrorPayload,
} from '@gtrz/contracts';

export interface AppErrorView {
  readonly code: AppErrorCode;
  readonly message: string;
  readonly details: Readonly<Record<string, unknown>> | null;
}

export function resolveAppError(error: unknown, fallbackMessage: string): AppErrorView {
  const parsed = appErrorPayloadSchema.safeParse(error);

  if (parsed.success) {
    return parsed.data;
  }

  return {
    code: 'UNEXPECTED_ERROR',
    message: error instanceof Error && error.message.length > 0 ? error.message : fallbackMessage,
    details: null,
  };
}

export function getAppErrorMessage(error: unknown, fallbackMessage: string): string {
  return resolveAppError(error, fallbackMessage).message;
}

export function isAppErrorCode(error: unknown, code: AppErrorCode): error is AppErrorPayload {
  const parsed = appErrorPayloadSchema.safeParse(error);
  return parsed.success && parsed.data.code === code;
}
