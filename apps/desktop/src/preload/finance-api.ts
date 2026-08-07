import { ipcRenderer } from 'electron';

import {
  cancelExpenseInputSchema,
  cashStateSchema,
  closeCashRegisterInputSchema,
  createExpenseInputSchema,
  expenseSchema,
  expenseStateSchema,
  IPC_CHANNELS,
  openCashRegisterInputSchema,
  payExpenseInputSchema,
  recordCashMovementInputSchema,
  refundExpensePaymentInputSchema,
  type CancelExpenseInput,
  type CashApi,
  type CashState,
  type CloseCashRegisterInput,
  type CreateExpenseInput,
  type Expense,
  type ExpenseApi,
  type ExpenseState,
  type OpenCashRegisterInput,
  type PayExpenseInput,
  type RecordCashMovementInput,
  type RefundExpensePaymentInput,
} from '@gtrz/contracts';

export const cashApi: CashApi = {
  async getState(): Promise<CashState> {
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.cashGetState);
    return cashStateSchema.parse(payload);
  },

  async open(input: OpenCashRegisterInput): Promise<CashState> {
    const parsedInput = openCashRegisterInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.cashOpen, parsedInput);
    return cashStateSchema.parse(payload);
  },

  async recordMovement(input: RecordCashMovementInput): Promise<CashState> {
    const parsedInput = recordCashMovementInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.cashRecordMovement, parsedInput);
    return cashStateSchema.parse(payload);
  },

  async close(input: CloseCashRegisterInput): Promise<CashState> {
    const parsedInput = closeCashRegisterInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.cashClose, parsedInput);
    return cashStateSchema.parse(payload);
  },
};

export const expenseApi: ExpenseApi = {
  async getState(): Promise<ExpenseState> {
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.expensesGetState);
    return expenseStateSchema.parse(payload);
  },

  async create(input: CreateExpenseInput): Promise<Expense> {
    const parsedInput = createExpenseInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.expensesCreate, parsedInput);
    return expenseSchema.parse(payload);
  },

  async pay(input: PayExpenseInput): Promise<Expense> {
    const parsedInput = payExpenseInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.expensesPay, parsedInput);
    return expenseSchema.parse(payload);
  },

  async refundPayment(input: RefundExpensePaymentInput): Promise<Expense> {
    const parsedInput = refundExpensePaymentInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.expensesRefundPayment,
      parsedInput,
    );
    return expenseSchema.parse(payload);
  },

  async cancel(input: CancelExpenseInput): Promise<Expense> {
    const parsedInput = cancelExpenseInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.expensesCancel, parsedInput);
    return expenseSchema.parse(payload);
  },
};
