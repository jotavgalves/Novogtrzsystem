import { ipcMain } from 'electron';
import { z } from 'zod';

import {
  changeVoucherStatusInputSchema,
  createVoucherInputSchema,
  deleteVoucherInputSchema,
  IPC_CHANNELS,
  listVouchersForServicePointInputSchema,
  previewDeleteVoucherInputSchema,
  updateVoucherInputSchema,
  voucherDeletePreviewSchema,
  voucherSchema,
  voucherStateSchema,
} from '@gtrz/contracts';
import {
  changeVoucherStatus,
  createVoucher,
  deleteVoucher,
  getVoucherState,
  listAvailableVouchersForServicePoint,
  previewDeleteVoucher,
  updateVoucher,
  type DatabaseContext,
} from '@gtrz/database';

interface RegisterVoucherIpcOptions {
  readonly getDatabase: () => DatabaseContext;
}

const VOUCHER_CHANNELS = [
  IPC_CHANNELS.vouchersGetState,
  IPC_CHANNELS.vouchersListForServicePoint,
  IPC_CHANNELS.vouchersCreate,
  IPC_CHANNELS.vouchersUpdate,
  IPC_CHANNELS.vouchersPreviewDelete,
  IPC_CHANNELS.vouchersDelete,
  IPC_CHANNELS.vouchersChangeStatus,
] as const;

export function registerVoucherIpcHandlers(options: RegisterVoucherIpcOptions): void {
  for (const channel of VOUCHER_CHANNELS) {
    ipcMain.removeHandler(channel);
  }

  ipcMain.handle(IPC_CHANNELS.vouchersGetState, () => {
    return voucherStateSchema.parse(getVoucherState(options.getDatabase()));
  });

  ipcMain.handle(IPC_CHANNELS.vouchersListForServicePoint, (_event, payload: unknown) => {
    const input = listVouchersForServicePointInputSchema.parse(payload);
    return z
      .array(voucherSchema)
      .parse(listAvailableVouchersForServicePoint(options.getDatabase(), input));
  });

  ipcMain.handle(IPC_CHANNELS.vouchersCreate, (_event, payload: unknown) => {
    const input = createVoucherInputSchema.parse(payload);
    return voucherSchema.parse(createVoucher(options.getDatabase(), input));
  });

  ipcMain.handle(IPC_CHANNELS.vouchersUpdate, (_event, payload: unknown) => {
    const input = updateVoucherInputSchema.parse(payload);
    return voucherSchema.parse(updateVoucher(options.getDatabase(), input));
  });

  ipcMain.handle(IPC_CHANNELS.vouchersPreviewDelete, (_event, payload: unknown) => {
    const input = previewDeleteVoucherInputSchema.parse(payload);
    return voucherDeletePreviewSchema.parse(previewDeleteVoucher(options.getDatabase(), input));
  });

  ipcMain.handle(IPC_CHANNELS.vouchersDelete, (_event, payload: unknown) => {
    const input = deleteVoucherInputSchema.parse(payload);
    return voucherSchema.parse(deleteVoucher(options.getDatabase(), input));
  });

  ipcMain.handle(IPC_CHANNELS.vouchersChangeStatus, (_event, payload: unknown) => {
    const input = changeVoucherStatusInputSchema.parse(payload);
    return voucherSchema.parse(changeVoucherStatus(options.getDatabase(), input));
  });
}
