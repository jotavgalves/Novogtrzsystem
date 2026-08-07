import { ipcRenderer } from 'electron';

import {
  addOrderItemInputSchema,
  bindOrderVoucherInputSchema,
  cancelOrderInputSchema,
  closeOrderInputSchema,
  createServicePointInputSchema,
  getOrderInputSchema,
  IPC_CHANNELS,
  openOrderInputSchema,
  operationStateSchema,
  orderSchema,
  removeOrderItemInputSchema,
  servicePointSchema,
  unbindOrderVoucherInputSchema,
  type AddOrderItemInput,
  type BindOrderVoucherInput,
  type CancelOrderInput,
  type CloseOrderInput,
  type CreateServicePointInput,
  type OpenOrderInput,
  type OperationState,
  type OperationsApi,
  type Order,
  type RemoveOrderItemInput,
  type ServicePoint,
  type UnbindOrderVoucherInput,
} from '@gtrz/contracts';

export const operationsApi: OperationsApi = {
  async getState(): Promise<OperationState> {
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.operationsGetState);
    return operationStateSchema.parse(payload);
  },

  async createServicePoint(input: CreateServicePointInput): Promise<ServicePoint> {
    const parsedInput = createServicePointInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.operationsCreateServicePoint,
      parsedInput,
    );
    return servicePointSchema.parse(payload);
  },

  async openOrder(input: OpenOrderInput): Promise<Order> {
    const parsedInput = openOrderInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.operationsOpenOrder,
      parsedInput,
    );
    return orderSchema.parse(payload);
  },

  async getOrder(orderId: string): Promise<Order> {
    const parsedInput = getOrderInputSchema.parse({ orderId });
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.operationsGetOrder, parsedInput);
    return orderSchema.parse(payload);
  },

  async addItem(input: AddOrderItemInput): Promise<Order> {
    const parsedInput = addOrderItemInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.operationsAddItem, parsedInput);
    return orderSchema.parse(payload);
  },

  async removeItem(input: RemoveOrderItemInput): Promise<Order> {
    const parsedInput = removeOrderItemInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.operationsRemoveItem,
      parsedInput,
    );
    return orderSchema.parse(payload);
  },

  async bindVoucher(input: BindOrderVoucherInput): Promise<Order> {
    const parsedInput = bindOrderVoucherInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.operationsBindVoucher,
      parsedInput,
    );
    return orderSchema.parse(payload);
  },

  async unbindVoucher(input: UnbindOrderVoucherInput): Promise<Order> {
    const parsedInput = unbindOrderVoucherInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.operationsUnbindVoucher,
      parsedInput,
    );
    return orderSchema.parse(payload);
  },

  async closeOrder(input: CloseOrderInput): Promise<Order> {
    const parsedInput = closeOrderInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.operationsCloseOrder,
      parsedInput,
    );
    return orderSchema.parse(payload);
  },

  async cancelOrder(input: CancelOrderInput): Promise<Order> {
    const parsedInput = cancelOrderInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.operationsCancelOrder,
      parsedInput,
    );
    return orderSchema.parse(payload);
  },
};
