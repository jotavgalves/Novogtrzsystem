import {
  comboListSchema,
  comboDeletePreviewSchema,
  comboSchema,
  createComboInputSchema,
  deleteComboInputSchema,
  IPC_CHANNELS,
  previewDeleteComboInputSchema,
  updateComboInputSchema,
  type ComboApi,
  type ComboDeletePreview,
  type CreateComboInput,
  type DeleteComboInput,
  type InventoryCombo,
  type PreviewDeleteComboInput,
  type UpdateComboInput,
} from '@gtrz/contracts';

import { typedIpcRenderer as ipcRenderer } from './invoke-ipc';

export const comboApi: ComboApi = {
  async list(): Promise<readonly InventoryCombo[]> {
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.combosList);
    return comboListSchema.parse(payload);
  },
  async create(input: CreateComboInput): Promise<InventoryCombo> {
    const parsedInput = createComboInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.combosCreate, parsedInput);
    return comboSchema.parse(payload);
  },
  async update(input: UpdateComboInput): Promise<InventoryCombo> {
    const parsedInput = updateComboInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.combosUpdate, parsedInput);
    return comboSchema.parse(payload);
  },
  async previewDelete(input: PreviewDeleteComboInput): Promise<ComboDeletePreview> {
    const parsedInput = previewDeleteComboInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.combosPreviewDelete,
      parsedInput,
    );
    return comboDeletePreviewSchema.parse(payload);
  },
  async delete(input: DeleteComboInput): Promise<InventoryCombo> {
    const parsedInput = deleteComboInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.combosDelete, parsedInput);
    return comboSchema.parse(payload);
  },
};
