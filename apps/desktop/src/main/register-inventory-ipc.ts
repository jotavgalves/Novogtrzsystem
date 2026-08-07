import { ipcMain } from 'electron';

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
} from '@gtrz/contracts';
import {
  createInventoryProduct,
  createProductCategory,
  deleteProduct,
  getInventoryState,
  listStockTransfers,
  previewDeleteProduct,
  recordStockMovement,
  transferStockBetweenEvents,
  updateInventoryProduct,
  type DatabaseContext,
} from '@gtrz/database';

interface RegisterInventoryIpcOptions {
  readonly getDatabase: () => DatabaseContext;
}

const INVENTORY_CHANNELS = [
  IPC_CHANNELS.inventoryGetState,
  IPC_CHANNELS.inventoryCreateCategory,
  IPC_CHANNELS.inventoryCreateProduct,
  IPC_CHANNELS.inventoryUpdateProduct,
  IPC_CHANNELS.inventoryPreviewDeleteProduct,
  IPC_CHANNELS.inventoryDeleteProduct,
  IPC_CHANNELS.inventoryRecordMovement,
  IPC_CHANNELS.inventoryListTransfers,
  IPC_CHANNELS.inventoryTransferStock,
] as const;

export function registerInventoryIpcHandlers(options: RegisterInventoryIpcOptions): void {
  for (const channel of INVENTORY_CHANNELS) {
    ipcMain.removeHandler(channel);
  }

  ipcMain.handle(IPC_CHANNELS.inventoryGetState, () => {
    return inventoryStateSchema.parse(getInventoryState(options.getDatabase()));
  });

  ipcMain.handle(IPC_CHANNELS.inventoryCreateCategory, (_event, payload: unknown) => {
    const input = createCategoryInputSchema.parse(payload);
    return productCategorySchema.parse(createProductCategory(options.getDatabase(), input.name));
  });

  ipcMain.handle(IPC_CHANNELS.inventoryCreateProduct, (_event, payload: unknown) => {
    const input = createProductInputSchema.parse(payload);
    return inventoryProductSchema.parse(createInventoryProduct(options.getDatabase(), input));
  });

  ipcMain.handle(IPC_CHANNELS.inventoryUpdateProduct, (_event, payload: unknown) => {
    const input = updateProductInputSchema.parse(payload);
    return inventoryProductSchema.parse(updateInventoryProduct(options.getDatabase(), input));
  });

  ipcMain.handle(IPC_CHANNELS.inventoryPreviewDeleteProduct, (_event, payload: unknown) => {
    const input = previewDeleteProductInputSchema.parse(payload);
    return productDeletePreviewSchema.parse(previewDeleteProduct(options.getDatabase(), input));
  });

  ipcMain.handle(IPC_CHANNELS.inventoryDeleteProduct, (_event, payload: unknown) => {
    const input = deleteProductInputSchema.parse(payload);
    return inventoryProductSchema.parse(deleteProduct(options.getDatabase(), input));
  });

  ipcMain.handle(IPC_CHANNELS.inventoryRecordMovement, (_event, payload: unknown) => {
    const input = recordStockMovementInputSchema.parse(payload);
    const movementInput =
      input.note === undefined
        ? {
            productId: input.productId,
            type: input.type,
            quantity: input.quantity,
          }
        : {
            productId: input.productId,
            type: input.type,
            quantity: input.quantity,
            note: input.note,
          };

    return inventoryProductSchema.parse(recordStockMovement(options.getDatabase(), movementInput));
  });

  ipcMain.handle(IPC_CHANNELS.inventoryListTransfers, () => {
    return stockTransferListSchema.parse(listStockTransfers(options.getDatabase()));
  });

  ipcMain.handle(IPC_CHANNELS.inventoryTransferStock, (_event, payload: unknown) => {
    const input = transferStockInputSchema.parse(payload);
    const transferInput =
      input.note === undefined
        ? {
            productId: input.productId,
            sourceEventId: input.sourceEventId,
            destinationEventId: input.destinationEventId,
            quantity: input.quantity,
          }
        : {
            productId: input.productId,
            sourceEventId: input.sourceEventId,
            destinationEventId: input.destinationEventId,
            quantity: input.quantity,
            note: input.note,
          };

    return stockTransferSchema.parse(
      transferStockBetweenEvents(options.getDatabase(), transferInput),
    );
  });
}
