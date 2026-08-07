import { z } from 'zod';

import { salesByMethodSchema } from './finance';

export const eventCloseCashStatusSchema = z.enum(['missing', 'open', 'closed']);

export const eventCloseSummarySchema = z.object({
  eventId: z.uuid(),
  eventName: z.string().min(2),
  generatedAt: z.number().int().nonnegative(),
  openOrdersCount: z.number().int().nonnegative(),
  paidOrdersCount: z.number().int().nonnegative(),
  cancelledOrdersCount: z.number().int().nonnegative(),
  cashStatus: eventCloseCashStatusSchema,
  requiresCashCount: z.boolean(),
  expectedCashCents: z.number().int(),
  countedCashCents: z.number().int().nonnegative().nullable(),
  varianceCents: z.number().int().nullable(),
  salesByMethod: salesByMethodSchema,
  grossSalesCents: z.number().int().nonnegative(),
  activeExpensesCents: z.number().int().nonnegative(),
  projectedResultCents: z.number().int(),
  ticketSalesCount: z.number().int().nonnegative(),
  ticketSoldQuantity: z.number().int().nonnegative(),
  ticketCourtesyQuantity: z.number().int().nonnegative(),
  ticketRevenueCents: z.number().int().nonnegative(),
  voucherCount: z.number().int().nonnegative(),
  vouchersIssuedCents: z.number().int().nonnegative(),
  vouchersRemainingCents: z.number().int().nonnegative(),
  blockers: z.array(z.string()),
  canClose: z.boolean(),
});

export const eventClosePreviewInputSchema = z.object({
  eventId: z.uuid(),
});

export const completeEventCloseInputSchema = z.object({
  eventId: z.uuid(),
  countedCashCents: z.number().int().nonnegative().optional(),
});

export const eventCloseEventSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(100),
  status: z.literal('closed'),
  startsAt: z.number().int().nonnegative(),
  endsAt: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const eventCloseBackupSchema = z.object({
  fileName: z.string().min(1),
  filePath: z.string().min(1),
  kind: z.literal('event-close'),
  createdAt: z.number().int().nonnegative(),
  sizeBytes: z.number().int().nonnegative(),
  integrity: z.literal('valid'),
});

export const eventCloseResultSchema = z.object({
  event: eventCloseEventSchema,
  summary: eventCloseSummarySchema,
  backup: eventCloseBackupSchema,
});

export type EventCloseCashStatus = z.infer<typeof eventCloseCashStatusSchema>;
export type EventCloseSummary = z.infer<typeof eventCloseSummarySchema>;
export type EventClosePreviewInput = z.infer<typeof eventClosePreviewInputSchema>;
export type CompleteEventCloseInput = z.infer<typeof completeEventCloseInputSchema>;
export type EventCloseResult = z.infer<typeof eventCloseResultSchema>;

export interface EventCloseApi {
  preview(input: EventClosePreviewInput): Promise<EventCloseSummary>;
  complete(input: CompleteEventCloseInput): Promise<EventCloseResult>;
}
