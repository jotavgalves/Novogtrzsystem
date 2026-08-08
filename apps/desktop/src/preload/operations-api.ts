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
  setOrderItemQuantityInputSchema,
  setServicePointPinnedInputSchema,
  unbindOrderVoucherInputSchema,
  type AddOrderItemInput,
  type BindOrderVoucherInput,
  type CancelOrderInput,
  type CloseOrderInput,
  type CreateServicePointInput,
  type DeleteServicePointInput,
  type OpenOrderInput,
  type OperationState,
  type OperationsApi,
  type Order,
  type PreviewDeleteServicePointInput,
  type RemoveOrderItemInput,
  type ServicePoint,
  type ServicePointDeletePreview,
  type SetOrderItemQuantityInput,
  type SetServicePointPinnedInput,
  type UnbindOrderVoucherInput,
} from '@gtrz/contracts';

import { typedIpcRenderer as ipcRenderer } from './invoke-ipc';

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

  async setServicePointPinned(input: SetServicePointPinnedInput): Promise<ServicePoint> {
    const parsedInput = setServicePointPinnedInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      OPERATIONS_IPC_CHANNELS.setServicePointPinned,
      parsedInput,
    );
    return servicePointSchema.parse(payload);
  },

  async previewDeleteServicePoint(
    input: PreviewDeleteServicePointInput,
  ): Promise<ServicePointDeletePreview> {
    const parsedInput = previewDeleteServicePointInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      OPERATIONS_IPC_CHANNELS.previewDeleteServicePoint,
      parsedInput,
    );
    return servicePointDeletePreviewSchema.parse(payload);
  },

  async deleteServicePoint(input: DeleteServicePointInput): Promise<ServicePointDeletePreview> {
    const parsedInput = deleteServicePointInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      OPERATIONS_IPC_CHANNELS.deleteServicePoint,
      parsedInput,
    );
    return servicePointDeletePreviewSchema.parse(payload);
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

  async setItemQuantity(input: SetOrderItemQuantityInput): Promise<Order> {
    const parsedInput = setOrderItemQuantityInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.operationsSetItemQuantity,
      parsedInput,
    );
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
