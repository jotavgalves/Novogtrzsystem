import { ipcRenderer } from 'electron';

import {
  createCategoryInputSchema,
  createProductInputSchema,
  deleteProductInputSchema,
  inventoryProductSchema,
  inventoryStateSchema,
  IPC_CHANNELS,
  previewDeleteProductInputSchema,
  productDeletePreviewSchema,
  productCategorySchema,
  recordStockMovementInputSchema,
  stockTransferListSchema,
  stockTransferSchema,
  transferStockInputSchema,
  updateProductInputSchema,
  type CreateCategoryInput,
  type CreateProductInput,
  type DeleteProductInput,
  type InventoryApi,
  type InventoryProduct,
  type InventoryState,
  type PreviewDeleteProductInput,
  type ProductDeletePreview,
  type ProductCategory,
  type RecordStockMovementInput,
  type StockTransfer,
  type TransferStockInput,
  type UpdateProductInput,
} from '@gtrz/contracts';

export const inventoryApi: InventoryApi = {
  async getState(): Promise<InventoryState> {
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.inventoryGetState);
    return inventoryStateSchema.parse(payload);
  },
  async createCategory(input: CreateCategoryInput): Promise<ProductCategory> {
    const parsedInput = createCategoryInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.inventoryCreateCategory,
      parsedInput,
    );
    return productCategorySchema.parse(payload);
  },
  async createProduct(input: CreateProductInput): Promise<InventoryProduct> {
    const parsedInput = createProductInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.inventoryCreateProduct,
      parsedInput,
    );
    return inventoryProductSchema.parse(payload);
  },
  async updateProduct(input: UpdateProductInput): Promise<InventoryProduct> {
    const parsedInput = updateProductInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.inventoryUpdateProduct,
      parsedInput,
    );
    return inventoryProductSchema.parse(payload);
  },
  async previewDeleteProduct(input: PreviewDeleteProductInput): Promise<ProductDeletePreview> {
    const parsedInput = previewDeleteProductInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.inventoryPreviewDeleteProduct,
      parsedInput,
    );
    return productDeletePreviewSchema.parse(payload);
  },
  async deleteProduct(input: DeleteProductInput): Promise<InventoryProduct> {
    const parsedInput = deleteProductInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.inventoryDeleteProduct,
      parsedInput,
    );
    return inventoryProductSchema.parse(payload);
  },
  async recordMovement(input: RecordStockMovementInput): Promise<InventoryProduct> {
    const parsedInput = recordStockMovementInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.inventoryRecordMovement,
      parsedInput,
    );
    return inventoryProductSchema.parse(payload);
  },
  async listTransfers(): Promise<readonly StockTransfer[]> {
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.inventoryListTransfers);
    return stockTransferListSchema.parse(payload);
  },
  async transferStock(input: TransferStockInput): Promise<StockTransfer> {
    const parsedInput = transferStockInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.inventoryTransferStock,
      parsedInput,
    );
    return stockTransferSchema.parse(payload);
  },
};
