import { ipcMain } from 'electron';

import {
  addOrderItemInputSchema,
  bindOrderVoucherInputSchema,
  cancelOrderInputSchema,
  closeOrderInputSchema,
  createServicePointInputSchema,
  deleteServicePointInputSchema,
  getOrderInputSchema,
  IPC_CHANNELS,
  openOrderInputSchema,
  OPERATIONS_IPC_CHANNELS,
  operationStateSchema,
  orderSchema,
  previewDeleteServicePointInputSchema,
  removeOrderItemInputSchema,
  servicePointDeletePreviewSchema,
  servicePointSchema,
  unbindOrderVoucherInputSchema,
} from '@gtrz/contracts';
import {
  addOrderItem,
  bindOrderVoucher,
  cancelOrder,
  closeOrder,
  createServicePoint,
  deleteServicePoint,
  getOperationState,
  getOrder,
  openOrder,
  previewDeleteServicePoint,
  removeOrderItem,
  type DatabaseCloseOrderPaymentInput,
  type DatabaseContext,
  unbindOrderVoucher,
} from '@gtrz/database';

import { handleIpc } from './ipc-handler';

interface RegisterOperationsIpcOptions {
  readonly getDatabase: () => DatabaseContext;
}

const OPERATION_CHANNELS = [
  IPC_CHANNELS.operationsGetState,
  IPC_CHANNELS.operationsCreateServicePoint,
  OPERATIONS_IPC_CHANNELS.previewDeleteServicePoint,
  OPERATIONS_IPC_CHANNELS.deleteServicePoint,
  IPC_CHANNELS.operationsOpenOrder,
  IPC_CHANNELS.operationsGetOrder,
  IPC_CHANNELS.operationsAddItem,
  IPC_CHANNELS.operationsRemoveItem,
  IPC_CHANNELS.operationsBindVoucher,
  IPC_CHANNELS.operationsUnbindVoucher,
  IPC_CHANNELS.operationsCloseOrder,
  IPC_CHANNELS.operationsCancelOrder,
] as const;

function normalizePayment(
  payment: Readonly<{
    method: DatabaseCloseOrderPaymentInput['method'];
    amountCents: number;
    receivedCents?: number | undefined;
  }>,
): DatabaseCloseOrderPaymentInput {
  return payment.receivedCents === undefined
    ? { method: payment.method, amountCents: payment.amountCents }
    : {
        method: payment.method,
        amountCents: payment.amountCents,
        receivedCents: payment.receivedCents,
      };
}

export function registerOperationsIpcHandlers(options: RegisterOperationsIpcOptions): void {
  for (const channel of OPERATION_CHANNELS) {
    ipcMain.removeHandler(channel);
  }

  handleIpc(IPC_CHANNELS.operationsGetState, () => {
    return operationStateSchema.parse(getOperationState(options.getDatabase()));
  });

  handleIpc(IPC_CHANNELS.operationsCreateServicePoint, (_event, payload: unknown) => {
    const input = createServicePointInputSchema.parse(payload);
    return servicePointSchema.parse(createServicePoint(options.getDatabase(), input));
  });

  handleIpc(OPERATIONS_IPC_CHANNELS.previewDeleteServicePoint, (_event, payload: unknown) => {
    const input = previewDeleteServicePointInputSchema.parse(payload);
    return servicePointDeletePreviewSchema.parse(
      previewDeleteServicePoint(options.getDatabase(), input),
    );
  });

  handleIpc(OPERATIONS_IPC_CHANNELS.deleteServicePoint, (_event, payload: unknown) => {
    const input = deleteServicePointInputSchema.parse(payload);
    return servicePointDeletePreviewSchema.parse(deleteServicePoint(options.getDatabase(), input));
  });

  handleIpc(IPC_CHANNELS.operationsOpenOrder, (_event, payload: unknown) => {
    const input = openOrderInputSchema.parse(payload);
    return orderSchema.parse(openOrder(options.getDatabase(), input.servicePointId));
  });

  handleIpc(IPC_CHANNELS.operationsGetOrder, (_event, payload: unknown) => {
    const input = getOrderInputSchema.parse(payload);
    return orderSchema.parse(getOrder(options.getDatabase(), input.orderId));
  });

  handleIpc(IPC_CHANNELS.operationsAddItem, (_event, payload: unknown) => {
    const input = addOrderItemInputSchema.parse(payload);
    return orderSchema.parse(addOrderItem(options.getDatabase(), input));
  });

  handleIpc(IPC_CHANNELS.operationsRemoveItem, (_event, payload: unknown) => {
    const input = removeOrderItemInputSchema.parse(payload);
    return orderSchema.parse(removeOrderItem(options.getDatabase(), input));
  });

  handleIpc(IPC_CHANNELS.operationsBindVoucher, (_event, payload: unknown) => {
    const input = bindOrderVoucherInputSchema.parse(payload);
    bindOrderVoucher(options.getDatabase(), input);
    return orderSchema.parse(getOrder(options.getDatabase(), input.orderId));
  });

  handleIpc(IPC_CHANNELS.operationsUnbindVoucher, (_event, payload: unknown) => {
    const input = unbindOrderVoucherInputSchema.parse(payload);
    unbindOrderVoucher(options.getDatabase(), input.orderId);
    return orderSchema.parse(getOrder(options.getDatabase(), input.orderId));
  });

  handleIpc(IPC_CHANNELS.operationsCloseOrder, (_event, payload: unknown) => {
    const input = closeOrderInputSchema.parse(payload);
    return orderSchema.parse(
      closeOrder(options.getDatabase(), {
        orderId: input.orderId,
        discountCents: input.discountCents,
        payments: input.payments.map(normalizePayment),
        voucherUses: input.voucherUses,
      }),
    );
  });

  handleIpc(IPC_CHANNELS.operationsCancelOrder, (_event, payload: unknown) => {
    const input = cancelOrderInputSchema.parse(payload);
    return orderSchema.parse(cancelOrder(options.getDatabase(), input));
  });
}
