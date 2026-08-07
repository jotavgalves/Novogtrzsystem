import { ipcRenderer } from 'electron';

import {
  changeVoucherStatusInputSchema,
  createVoucherInputSchema,
  deleteVoucherInputSchema,
  IPC_CHANNELS,
  listVouchersForServicePointInputSchema,
  previewDeleteVoucherInputSchema,
  updateVoucherInputSchema,
  voucherDeletePreviewSchema,
  voucherListSchema,
  voucherSchema,
  voucherStateSchema,
  type ChangeVoucherStatusInput,
  type CreateVoucherInput,
  type DeleteVoucherInput,
  type ListVouchersForServicePointInput,
  type PreviewDeleteVoucherInput,
  type UpdateVoucherInput,
  type Voucher,
  type VoucherApi,
  type VoucherDeletePreview,
  type VoucherState,
} from '@gtrz/contracts';

export const voucherApi: VoucherApi = {
  async getState(): Promise<VoucherState> {
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.vouchersGetState);
    return voucherStateSchema.parse(payload);
  },

  async listForServicePoint(input: ListVouchersForServicePointInput): Promise<readonly Voucher[]> {
    const parsedInput = listVouchersForServicePointInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.vouchersListForServicePoint,
      parsedInput,
    );
    return voucherListSchema.parse(payload);
  },

  async create(input: CreateVoucherInput): Promise<Voucher> {
    const parsedInput = createVoucherInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.vouchersCreate, parsedInput);
    return voucherSchema.parse(payload);
  },

  async update(input: UpdateVoucherInput): Promise<Voucher> {
    const parsedInput = updateVoucherInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.vouchersUpdate, parsedInput);
    return voucherSchema.parse(payload);
  },

  async previewDelete(input: PreviewDeleteVoucherInput): Promise<VoucherDeletePreview> {
    const parsedInput = previewDeleteVoucherInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.vouchersPreviewDelete,
      parsedInput,
    );
    return voucherDeletePreviewSchema.parse(payload);
  },

  async delete(input: DeleteVoucherInput): Promise<Voucher> {
    const parsedInput = deleteVoucherInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.vouchersDelete, parsedInput);
    return voucherSchema.parse(payload);
  },

  async changeStatus(input: ChangeVoucherStatusInput): Promise<Voucher> {
    const parsedInput = changeVoucherStatusInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.vouchersChangeStatus,
      parsedInput,
    );
    return voucherSchema.parse(payload);
  },
};
