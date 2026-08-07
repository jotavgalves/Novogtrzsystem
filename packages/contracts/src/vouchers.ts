import { z } from 'zod';

import { servicePointSchema } from './operations';

export const voucherStatusSchema = z.enum(['active', 'exhausted', 'cancelled']);
export const voucherTransactionTypeSchema = z.enum([
  'issue',
  'redemption',
  'cancellation',
  'reactivation',
  'refund',
]);

export const voucherSchema = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  code: z.string().trim().min(4).max(32),
  label: z.string().trim().min(2).max(100),
  linkedServicePointId: z.uuid().nullable(),
  linkedServicePointLabel: z.string().trim().min(1).max(40).nullable(),
  initialBalanceCents: z.number().int().positive(),
  remainingBalanceCents: z.number().int().nonnegative(),
  status: voucherStatusSchema,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const voucherTransactionSchema = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  voucherId: z.uuid(),
  voucherCode: z.string().min(4).max(32),
  orderId: z.uuid().nullable(),
  type: voucherTransactionTypeSchema,
  amountCents: z.number().int().nonnegative(),
  balanceBeforeCents: z.number().int().nonnegative(),
  balanceAfterCents: z.number().int().nonnegative(),
  note: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
});

export const voucherStateSchema = z.object({
  activeEventId: z.uuid().nullable(),
  servicePoints: z.array(servicePointSchema),
  vouchers: z.array(voucherSchema),
  transactions: z.array(voucherTransactionSchema),
});

export const createVoucherInputSchema = z.object({
  code: z.string().trim().min(4).max(32).optional(),
  label: z.string().trim().min(2).max(100),
  linkedServicePointId: z.uuid().nullable().optional(),
  initialBalanceCents: z.number().int().positive(),
});

export const changeVoucherStatusInputSchema = z.object({
  voucherId: z.uuid(),
  status: z.enum(['active', 'cancelled']),
});

export const updateVoucherInputSchema = z.object({
  voucherId: z.uuid(),
  code: z.string().trim().min(4).max(32),
  label: z.string().trim().min(2).max(100),
  linkedServicePointId: z.uuid().nullable(),
  addedBalanceCents: z.number().int().nonnegative(),
});

export const voucherDeletePreviewSchema = z.object({
  voucherId: z.uuid(),
  code: z.string().trim().min(4).max(32),
  label: z.string().trim().min(2).max(100),
  remainingBalanceCents: z.number().int().nonnegative(),
  openAllocations: z.number().int().nonnegative(),
  paidOrders: z.number().int().nonnegative(),
  paidOrderIds: z.array(z.uuid()),
  refundVoucherCents: z.number().int().nonnegative(),
  affectedOrderTotalCents: z.number().int().nonnegative(),
});

export const previewDeleteVoucherInputSchema = z.object({
  voucherId: z.uuid(),
});

export const deleteVoucherInputSchema = z.object({
  voucherId: z.uuid(),
  reason: z.string().trim().min(3).max(240),
});

export type VoucherStatus = z.infer<typeof voucherStatusSchema>;
export type VoucherTransactionType = z.infer<typeof voucherTransactionTypeSchema>;
export type Voucher = z.infer<typeof voucherSchema>;
export type VoucherTransaction = z.infer<typeof voucherTransactionSchema>;
export type VoucherState = z.infer<typeof voucherStateSchema>;
export type CreateVoucherInput = z.infer<typeof createVoucherInputSchema>;
export type ChangeVoucherStatusInput = z.infer<typeof changeVoucherStatusInputSchema>;
export type UpdateVoucherInput = z.infer<typeof updateVoucherInputSchema>;
export type VoucherDeletePreview = z.infer<typeof voucherDeletePreviewSchema>;
export type PreviewDeleteVoucherInput = z.infer<typeof previewDeleteVoucherInputSchema>;
export type DeleteVoucherInput = z.infer<typeof deleteVoucherInputSchema>;

export interface VoucherApi {
  getState(): Promise<VoucherState>;
  create(input: CreateVoucherInput): Promise<Voucher>;
  update(input: UpdateVoucherInput): Promise<Voucher>;
  previewDelete(input: PreviewDeleteVoucherInput): Promise<VoucherDeletePreview>;
  delete(input: DeleteVoucherInput): Promise<Voucher>;
  changeStatus(input: ChangeVoucherStatusInput): Promise<Voucher>;
}
