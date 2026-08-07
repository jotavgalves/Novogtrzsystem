import { z } from 'zod';

export const appErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'FORBIDDEN',
  'CONFLICT',
  'INVALID_STATE',
  'INSUFFICIENT_STOCK',
  'INSUFFICIENT_BALANCE',
  'INTEGRITY_ERROR',
  'IO_ERROR',
  'UNEXPECTED_ERROR',
]);

export const appErrorPayloadSchema = z.object({
  code: appErrorCodeSchema,
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).nullable(),
});

export const ipcResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    data: z.unknown(),
  }),
  z.object({
    ok: z.literal(false),
    error: appErrorPayloadSchema,
  }),
]);

export type AppErrorCode = z.infer<typeof appErrorCodeSchema>;
export type AppErrorPayload = z.infer<typeof appErrorPayloadSchema>;
export type IpcResponse = z.infer<typeof ipcResponseSchema>;
