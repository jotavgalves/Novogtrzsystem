import {
  cancelExpenseInputSchema,
  cashStateSchema,
  closeCashRegisterInputSchema,
  createExpenseInputSchema,
  expenseCancelPreviewSchema,
  expenseSchema,
  expenseStateSchema,
  IPC_CHANNELS,
  openCashRegisterInputSchema,
  payExpenseInputSchema,
  previewCancelExpenseInputSchema,
  recordCashMovementInputSchema,
  refundExpensePaymentInputSchema,
  updateExpenseInputSchema,
  type CancelExpenseInput,
  type CashApi,
  type CashState,
  type CloseCashRegisterInput,
  type CreateExpenseInput,
  type Expense,
  type ExpenseApi,
  type ExpenseCancelPreview,
  type ExpenseState,
  type OpenCashRegisterInput,
  type PayExpenseInput,
  type PreviewCancelExpenseInput,
  type RecordCashMovementInput,
  type RefundExpensePaymentInput,
  type UpdateExpenseInput,
} from '@gtrz/contracts';

import { invokeIpc } from './invoke-ipc';

export const cashApi: CashApi = {
  async getState(): Promise<CashState> {
    return invokeIpc(IPC_CHANNELS.cashGetState, cashStateSchema);
  },

  async open(input: OpenCashRegisterInput): Promise<CashState> {
    const parsedInput = openCashRegisterInputSchema.parse(input);
    return invokeIpc(IPC_CHANNELS.cashOpen, cashStateSchema, parsedInput);
  },

  async recordMovement(input: RecordCashMovementInput): Promise<CashState> {
    const parsedInput = recordCashMovementInputSchema.parse(input);
    return invokeIpc(IPC_CHANNELS.cashRecordMovement, cashStateSchema, parsedInput);
  },

  async close(input: CloseCashRegisterInput): Promise<CashState> {
    const parsedInput = closeCashRegisterInputSchema.parse(input);
    return invokeIpc(IPC_CHANNELS.cashClose, cashStateSchema, parsedInput);
  },
};

export const expenseApi: ExpenseApi = {
  async getState(): Promise<ExpenseState> {
    return invokeIpc(IPC_CHANNELS.expensesGetState, expenseStateSchema);
  },

  async create(input: CreateExpenseInput): Promise<Expense> {
    const parsedInput = createExpenseInputSchema.parse(input);
    return invokeIpc(IPC_CHANNELS.expensesCreate, expenseSchema, parsedInput);
  },

  async update(input: UpdateExpenseInput): Promise<Expense> {
    const parsedInput = updateExpenseInputSchema.parse(input);
    return invokeIpc(IPC_CHANNELS.expensesUpdate, expenseSchema, parsedInput);
  },

  async pay(input: PayExpenseInput): Promise<Expense> {
    const parsedInput = payExpenseInputSchema.parse(input);
    return invokeIpc(IPC_CHANNELS.expensesPay, expenseSchema, parsedInput);
  },

  async refundPayment(input: RefundExpensePaymentInput): Promise<Expense> {
    const parsedInput = refundExpensePaymentInputSchema.parse(input);
    return invokeIpc(IPC_CHANNELS.expensesRefundPayment, expenseSchema, parsedInput);
  },

  async previewCancel(input: PreviewCancelExpenseInput): Promise<ExpenseCancelPreview> {
    const parsedInput = previewCancelExpenseInputSchema.parse(input);
    return invokeIpc(
      IPC_CHANNELS.expensesPreviewCancel,
      expenseCancelPreviewSchema,
      parsedInput,
    );
  },

  async cancel(input: CancelExpenseInput): Promise<Expense> {
    const parsedInput = cancelExpenseInputSchema.parse(input);
    return invokeIpc(IPC_CHANNELS.expensesCancel, expenseSchema, parsedInput);
  },
};
