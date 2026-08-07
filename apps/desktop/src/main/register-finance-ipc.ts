import { ipcMain } from 'electron';

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
} from '@gtrz/contracts';
import {
  cancelExpense,
  closeCashRegister,
  createExpense,
  getCashState,
  getExpenseState,
  openCashRegister,
  payExpense,
  previewCancelExpense,
  recordCashMovement,
  refundExpensePayment,
  updateExpense,
  type DatabaseContext,
} from '@gtrz/database';

interface RegisterFinanceIpcOptions {
  readonly getDatabase: () => DatabaseContext;
}

const FINANCE_CHANNELS = [
  IPC_CHANNELS.cashGetState,
  IPC_CHANNELS.cashOpen,
  IPC_CHANNELS.cashRecordMovement,
  IPC_CHANNELS.cashClose,
  IPC_CHANNELS.expensesGetState,
  IPC_CHANNELS.expensesCreate,
  IPC_CHANNELS.expensesUpdate,
  IPC_CHANNELS.expensesPay,
  IPC_CHANNELS.expensesRefundPayment,
  IPC_CHANNELS.expensesPreviewCancel,
  IPC_CHANNELS.expensesCancel,
] as const;

export function registerFinanceIpcHandlers(options: RegisterFinanceIpcOptions): void {
  for (const channel of FINANCE_CHANNELS) {
    ipcMain.removeHandler(channel);
  }

  ipcMain.handle(IPC_CHANNELS.cashGetState, () => {
    return cashStateSchema.parse(getCashState(options.getDatabase()));
  });

  ipcMain.handle(IPC_CHANNELS.cashOpen, (_event, payload: unknown) => {
    const input = openCashRegisterInputSchema.parse(payload);
    return cashStateSchema.parse(openCashRegister(options.getDatabase(), input.openingCashCents));
  });

  ipcMain.handle(IPC_CHANNELS.cashRecordMovement, (_event, payload: unknown) => {
    const input = recordCashMovementInputSchema.parse(payload);
    const databaseInput =
      input.note === undefined
        ? { type: input.type, amountCents: input.amountCents }
        : { type: input.type, amountCents: input.amountCents, note: input.note };
    return cashStateSchema.parse(recordCashMovement(options.getDatabase(), databaseInput));
  });

  ipcMain.handle(IPC_CHANNELS.cashClose, (_event, payload: unknown) => {
    const input = closeCashRegisterInputSchema.parse(payload);
    return cashStateSchema.parse(closeCashRegister(options.getDatabase(), input.countedCashCents));
  });

  ipcMain.handle(IPC_CHANNELS.expensesGetState, () => {
    return expenseStateSchema.parse(getExpenseState(options.getDatabase()));
  });

  ipcMain.handle(IPC_CHANNELS.expensesCreate, (_event, payload: unknown) => {
    const input = createExpenseInputSchema.parse(payload);
    const databaseInput = {
      category: input.category,
      description: input.description,
      amountCents: input.amountCents,
      paymentMethod: input.paymentMethod,
      ...(input.initialPaymentCents === undefined
        ? {}
        : { initialPaymentCents: input.initialPaymentCents }),
      ...(input.note === undefined ? {} : { note: input.note }),
    };
    return expenseSchema.parse(createExpense(options.getDatabase(), databaseInput));
  });

  ipcMain.handle(IPC_CHANNELS.expensesUpdate, (_event, payload: unknown) => {
    const input = updateExpenseInputSchema.parse(payload);
    const databaseInput =
      input.note === undefined
        ? {
            expenseId: input.expenseId,
            category: input.category,
            description: input.description,
            amountCents: input.amountCents,
          }
        : {
            expenseId: input.expenseId,
            category: input.category,
            description: input.description,
            amountCents: input.amountCents,
            note: input.note,
          };
    return expenseSchema.parse(updateExpense(options.getDatabase(), databaseInput));
  });

  ipcMain.handle(IPC_CHANNELS.expensesPay, (_event, payload: unknown) => {
    const input = payExpenseInputSchema.parse(payload);
    const databaseInput =
      input.note === undefined
        ? {
            expenseId: input.expenseId,
            amountCents: input.amountCents,
            paymentMethod: input.paymentMethod,
          }
        : {
            expenseId: input.expenseId,
            amountCents: input.amountCents,
            paymentMethod: input.paymentMethod,
            note: input.note,
          };
    return expenseSchema.parse(payExpense(options.getDatabase(), databaseInput));
  });

  ipcMain.handle(IPC_CHANNELS.expensesRefundPayment, (_event, payload: unknown) => {
    const input = refundExpensePaymentInputSchema.parse(payload);
    return expenseSchema.parse(refundExpensePayment(options.getDatabase(), input));
  });

  ipcMain.handle(IPC_CHANNELS.expensesPreviewCancel, (_event, payload: unknown) => {
    const input = previewCancelExpenseInputSchema.parse(payload);
    return expenseCancelPreviewSchema.parse(previewCancelExpense(options.getDatabase(), input));
  });

  ipcMain.handle(IPC_CHANNELS.expensesCancel, (_event, payload: unknown) => {
    const input = cancelExpenseInputSchema.parse(payload);
    return expenseSchema.parse(cancelExpense(options.getDatabase(), input));
  });
}
