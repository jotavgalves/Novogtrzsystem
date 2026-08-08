import { z } from 'zod';

import { paymentMethodSchema } from './operations';

export const cashRegisterStatusSchema = z.enum(['open', 'closed']);
export const cashMovementTypeSchema = z.enum(['opening', 'supply', 'withdrawal']);

export const cashRegisterSchema = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  status: cashRegisterStatusSchema,
  openingCashCents: z.number().int().nonnegative(),
  expectedCashCents: z.number().int(),
  countedCashCents: z.number().int().nonnegative().nullable(),
  varianceCents: z.number().int().nullable(),
  openedAt: z.number().int().nonnegative(),
  closedAt: z.number().int().nonnegative().nullable(),
  updatedAt: z.number().int().nonnegative(),
});

export const cashMovementSchema = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  cashRegisterId: z.uuid(),
  type: cashMovementTypeSchema,
  amountCents: z.number().int().positive(),
  note: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
});

export const salesByMethodSchema = z.object({
  cashCents: z.number().int().nonnegative(),
  pixCents: z.number().int().nonnegative(),
  creditCardCents: z.number().int().nonnegative(),
  debitCardCents: z.number().int().nonnegative(),
  voucherCents: z.number().int().nonnegative(),
});

export const cashStateSchema = z.object({
  activeEventId: z.uuid().nullable(),
  register: cashRegisterSchema.nullable(),
  movements: z.array(cashMovementSchema),
  salesByMethod: salesByMethodSchema,
  grossSalesCents: z.number().int().nonnegative(),
  activeExpensesCents: z.number().int().nonnegative(),
  cashExpensesCents: z.number().int().nonnegative(),
  expectedCashCents: z.number().int(),
  projectedResultCents: z.number().int(),
});

export const openCashRegisterInputSchema = z.object({
  openingCashCents: z.number().int().nonnegative(),
});

export const recordCashMovementInputSchema = z.object({
  type: z.enum(['supply', 'withdrawal']),
  amountCents: z.number().int().positive(),
  note: z.string().trim().max(240).optional(),
});

export const closeCashRegisterInputSchema = z.object({
  countedCashCents: z.number().int().nonnegative(),
});

export const expenseStatusSchema = z.enum(['open', 'partial', 'paid', 'cancelled']);
export const expensePaymentStatusSchema = z.enum(['active', 'refunded']);

export const expensePaymentSchema = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  expenseId: z.uuid(),
  paymentMethod: paymentMethodSchema,
  amountCents: z.number().int().positive(),
  note: z.string().nullable(),
  status: expensePaymentStatusSchema,
  createdAt: z.number().int().nonnegative(),
  refundedAt: z.number().int().nonnegative().nullable(),
});

export const expenseSchema = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().min(2).max(160),
  amountCents: z.number().int().positive(),
  totalCents: z.number().int().positive(),
  paidCents: z.number().int().nonnegative(),
  pendingCents: z.number().int().nonnegative(),
  paymentMethod: paymentMethodSchema.nullable(),
  note: z.string().nullable(),
  status: expenseStatusSchema,
  payments: z.array(expensePaymentSchema),
  createdAt: z.number().int().nonnegative(),
  cancelledAt: z.number().int().nonnegative().nullable(),
  updatedAt: z.number().int().nonnegative(),
});

export const expenseStateSchema = z.object({
  activeEventId: z.uuid().nullable(),
  expenses: z.array(expenseSchema),
  manualExpenseCents: z.number().int().nonnegative(),
  inventoryCostCents: z.number().int().nonnegative(),
  totalExpenseCents: z.number().int().nonnegative(),
});

export const createExpenseInputSchema = z.object({
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().min(2).max(160),
  amountCents: z.number().int().positive(),
  initialPaymentCents: z.number().int().nonnegative().optional(),
  paymentMethod: paymentMethodSchema,
  note: z.string().trim().max(240).optional(),
});

export const updateExpenseInputSchema = z.object({
  expenseId: z.uuid(),
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().min(2).max(160),
  amountCents: z.number().int().positive(),
  note: z.string().trim().max(240).optional(),
});

export const payExpenseInputSchema = z.object({
  expenseId: z.uuid(),
  amountCents: z.number().int().positive(),
  paymentMethod: paymentMethodSchema,
  note: z.string().trim().max(240).optional(),
});

export const refundExpensePaymentInputSchema = z.object({
  paymentId: z.uuid(),
  reason: z.string().trim().min(3).max(240),
});

export const previewCancelExpenseInputSchema = z.object({
  expenseId: z.uuid(),
});

export const expenseCancelPreviewSchema = z.object({
  expenseId: z.uuid(),
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().min(2).max(160),
  status: z.enum(['open', 'partial', 'paid']),
  totalCents: z.number().int().positive(),
  paidCents: z.number().int().nonnegative(),
  pendingCents: z.number().int().nonnegative(),
  activePaymentCount: z.number().int().nonnegative(),
  refundTotalCents: z.number().int().nonnegative(),
  refundCashCents: z.number().int().nonnegative(),
  refundDigitalCents: z.number().int().nonnegative(),
  activePayments: z.array(
    z.object({
      id: z.uuid(),
      paymentMethod: paymentMethodSchema,
      amountCents: z.number().int().positive(),
      note: z.string().nullable(),
    }),
  ),
});

export const cancelExpenseInputSchema = z.object({
  expenseId: z.uuid(),
  reason: z.string().trim().min(3).max(240),
});

export type CashRegisterStatus = z.infer<typeof cashRegisterStatusSchema>;
export type CashMovementType = z.infer<typeof cashMovementTypeSchema>;
export type CashRegister = z.infer<typeof cashRegisterSchema>;
export type CashMovement = z.infer<typeof cashMovementSchema>;
export type SalesByMethod = z.infer<typeof salesByMethodSchema>;
export type CashState = z.infer<typeof cashStateSchema>;
export type OpenCashRegisterInput = z.infer<typeof openCashRegisterInputSchema>;
export type RecordCashMovementInput = z.infer<typeof recordCashMovementInputSchema>;
export type CloseCashRegisterInput = z.infer<typeof closeCashRegisterInputSchema>;
export type ExpenseStatus = z.infer<typeof expenseStatusSchema>;
export type ExpensePaymentStatus = z.infer<typeof expensePaymentStatusSchema>;
export type ExpensePayment = z.infer<typeof expensePaymentSchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type ExpenseState = z.infer<typeof expenseStateSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseInputSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseInputSchema>;
export type PayExpenseInput = z.infer<typeof payExpenseInputSchema>;
export type RefundExpensePaymentInput = z.infer<typeof refundExpensePaymentInputSchema>;
export type PreviewCancelExpenseInput = z.infer<typeof previewCancelExpenseInputSchema>;
export type ExpenseCancelPreview = z.infer<typeof expenseCancelPreviewSchema>;
export type CancelExpenseInput = z.infer<typeof cancelExpenseInputSchema>;

export interface CashApi {
  getState(): Promise<CashState>;
  open(input: OpenCashRegisterInput): Promise<CashState>;
  recordMovement(input: RecordCashMovementInput): Promise<CashState>;
  close(input: CloseCashRegisterInput): Promise<CashState>;
}

export interface ExpenseApi {
  getState(): Promise<ExpenseState>;
  create(input: CreateExpenseInput): Promise<Expense>;
  update(input: UpdateExpenseInput): Promise<Expense>;
  pay(input: PayExpenseInput): Promise<Expense>;
  refundPayment(input: RefundExpensePaymentInput): Promise<Expense>;
  previewCancel(input: PreviewCancelExpenseInput): Promise<ExpenseCancelPreview>;
  cancel(input: CancelExpenseInput): Promise<Expense>;
}
