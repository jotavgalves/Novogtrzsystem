import { z } from 'zod';

import type { ComboApi } from './combos';
import type { EventCloseApi } from './event-close';
import type { CashApi, ExpenseApi } from './finance';
import type { AuditApi, DashboardApi } from './insights';
import type { InventoryApi } from './inventory';
import type { OperationsApi } from './operations';
import type { ReceiptApi } from './receipts';
import type { TicketApi } from './tickets';
import type { VoucherApi } from './vouchers';

export * from './combos';
export * from './errors';
export * from './event-close';
export * from './finance';
export * from './insights';
export * from './inventory';
export * from './operations';
export * from './receipts';
export * from './tickets';
export * from './vouchers';

export const IPC_CHANNELS = {
  systemGetInfo: 'system:get-info',
  dashboardGetState: 'dashboard:get-state',
  auditList: 'audit:list',
  eventsList: 'events:list',
  eventsCreate: 'events:create',
  eventsRename: 'events:rename',
  eventsChangeStatus: 'events:change-status',
  eventsDelete: 'events:delete',
  eventsSetActive: 'events:set-active',
  eventClosePreview: 'event-close:preview',
  eventCloseComplete: 'event-close:complete',
  sessionGetState: 'session:get-state',
  sessionSwitchProfile: 'session:switch-profile',
  settingsChangeProductionPassword: 'settings:change-production-password',
  receiptsGetSettings: 'receipts:get-settings',
  receiptsUpdateSettings: 'receipts:update-settings',
  receiptsListPrinters: 'receipts:list-printers',
  receiptsPrintOrder: 'receipts:print-order',
  backupsGetState: 'backups:get-state',
  backupsChooseDestination: 'backups:choose-destination',
  backupsCreateManual: 'backups:create-manual',
  backupsImport: 'backups:import',
  backupsVerify: 'backups:verify',
  inventoryGetState: 'inventory:get-state',
  inventoryCreateCategory: 'inventory:create-category',
  inventoryCreateProduct: 'inventory:create-product',
  inventoryUpdateProduct: 'inventory:update-product',
  inventoryPreviewDeleteProduct: 'inventory:preview-delete-product',
  inventoryDeleteProduct: 'inventory:delete-product',
  inventoryRecordMovement: 'inventory:record-movement',
  inventoryListTransfers: 'inventory:list-transfers',
  inventoryTransferStock: 'inventory:transfer-stock',
  combosList: 'combos:list',
  combosCreate: 'combos:create',
  combosUpdate: 'combos:update',
  combosPreviewDelete: 'combos:preview-delete',
  combosDelete: 'combos:delete',
  operationsGetState: 'operations:get-state',
  operationsCreateServicePoint: 'operations:create-service-point',
  operationsOpenOrder: 'operations:open-order',
  operationsGetOrder: 'operations:get-order',
  operationsAddItem: 'operations:add-item',
  operationsSetItemQuantity: 'operations:set-item-quantity',
  operationsRemoveItem: 'operations:remove-item',
  operationsBindVoucher: 'operations:bind-voucher',
  operationsUnbindVoucher: 'operations:unbind-voucher',
  operationsCloseOrder: 'operations:close-order',
  operationsCancelOrder: 'operations:cancel-order',
  vouchersGetState: 'vouchers:get-state',
  vouchersListForServicePoint: 'vouchers:list-for-service-point',
  vouchersCreate: 'vouchers:create',
  vouchersUpdate: 'vouchers:update',
  vouchersPreviewDelete: 'vouchers:preview-delete',
  vouchersDelete: 'vouchers:delete',
  vouchersChangeStatus: 'vouchers:change-status',
  cashGetState: 'cash:get-state',
  cashOpen: 'cash:open',
  cashRecordMovement: 'cash:record-movement',
  cashClose: 'cash:close',
  expensesGetState: 'expenses:get-state',
  expensesCreate: 'expenses:create',
  expensesUpdate: 'expenses:update',
  expensesPay: 'expenses:pay',
  expensesRefundPayment: 'expenses:refund-payment',
  expensesPreviewCancel: 'expenses:preview-cancel',
  expensesCancel: 'expenses:cancel',
  ticketsGetState: 'tickets:get-state',
  ticketsCreateLot: 'tickets:create-lot',
  ticketsUpdateLot: 'tickets:update-lot',
  ticketsCreateSale: 'tickets:create-sale',
  ticketsCancelSale: 'tickets:cancel-sale',
  ticketsCancelCode: 'tickets:cancel-code',
  ticketsDeleteLot: 'tickets:delete-lot',
  ticketsDeleteSale: 'tickets:delete-sale',
  ticketsDeleteCode: 'tickets:delete-code',
} as const;

export const systemInfoSchema = z.object({
  appName: z.literal('GTRZ System'),
  version: z.string().min(1),
  platform: z.enum(['win32', 'linux', 'darwin']),
  databaseReady: z.boolean(),
});

export const userProfileSchema = z.enum(['production', 'cashier']);
export const eventStatusSchema = z.enum(['open', 'closed', 'archived']);

export const eventSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(100),
  status: eventStatusSchema,
  startsAt: z.number().int().nonnegative(),
  endsAt: z.number().int().nonnegative().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const eventListSchema = z.array(eventSchema);

export const createEventInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  startsAt: z.number().int().nonnegative(),
});

export const renameEventInputSchema = z.object({
  eventId: z.uuid(),
  name: z.string().trim().min(2).max(100),
});

export const changeEventStatusInputSchema = z.object({
  eventId: z.uuid(),
  status: eventStatusSchema,
});

export const deleteEventInputSchema = z.object({
  eventId: z.uuid(),
});

export const setActiveEventInputSchema = z.object({
  eventId: z.uuid().nullable(),
});

export const sessionStateSchema = z.object({
  profile: userProfileSchema,
  activeEvent: eventSchema.nullable(),
});

export const switchProfileInputSchema = z.object({
  targetProfile: userProfileSchema,
  password: z.string().max(128).optional(),
});

export const changeProductionPasswordInputSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(6).max(128),
});

export const operationResultSchema = z.object({
  success: z.literal(true),
});

export const backupKindSchema = z.enum(['automatic', 'event-close', 'manual', 'pre-restore']);
export const backupIntegritySchema = z.enum(['valid', 'invalid']);

export const backupRecordSchema = z.object({
  fileName: z.string().min(1),
  filePath: z.string().min(1),
  kind: backupKindSchema,
  createdAt: z.number().int().nonnegative(),
  sizeBytes: z.number().int().nonnegative(),
  integrity: backupIntegritySchema,
});

export const backupStateSchema = z.object({
  destinationPath: z.string().min(1),
  backups: z.array(backupRecordSchema),
});

export const verifyBackupInputSchema = z.object({
  filePath: z.string().min(1),
});

export const restoreBackupResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('cancelled') }),
  z.object({
    status: z.literal('restored'),
    sourceFileName: z.string().min(1),
    restoredAt: z.number().int().nonnegative(),
  }),
]);

export type SystemInfo = z.infer<typeof systemInfoSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type EventStatus = z.infer<typeof eventStatusSchema>;
export type GtrzEvent = z.infer<typeof eventSchema>;
export type CreateEventInput = z.infer<typeof createEventInputSchema>;
export type RenameEventInput = z.infer<typeof renameEventInputSchema>;
export type ChangeEventStatusInput = z.infer<typeof changeEventStatusInputSchema>;
export type DeleteEventInput = z.infer<typeof deleteEventInputSchema>;
export type SetActiveEventInput = z.infer<typeof setActiveEventInputSchema>;
export type SessionState = z.infer<typeof sessionStateSchema>;
export type SwitchProfileInput = z.infer<typeof switchProfileInputSchema>;
export type ChangeProductionPasswordInput = z.infer<typeof changeProductionPasswordInputSchema>;
export type OperationResult = z.infer<typeof operationResultSchema>;
export type BackupKind = z.infer<typeof backupKindSchema>;
export type BackupRecord = z.infer<typeof backupRecordSchema>;
export type BackupState = z.infer<typeof backupStateSchema>;
export type VerifyBackupInput = z.infer<typeof verifyBackupInputSchema>;
export type RestoreBackupResult = z.infer<typeof restoreBackupResultSchema>;

export interface GtrzDesktopApi {
  readonly system: {
    getInfo(): Promise<SystemInfo>;
  };
  readonly dashboard: DashboardApi;
  readonly audit: AuditApi;
  readonly events: {
    list(): Promise<readonly GtrzEvent[]>;
    create(input: CreateEventInput): Promise<GtrzEvent>;
    rename(input: RenameEventInput): Promise<GtrzEvent>;
    changeStatus(input: ChangeEventStatusInput): Promise<GtrzEvent>;
    delete(input: DeleteEventInput): Promise<OperationResult>;
    setActive(input: SetActiveEventInput): Promise<SessionState>;
  };
  readonly eventClose: EventCloseApi;
  readonly session: {
    getState(): Promise<SessionState>;
    switchProfile(input: SwitchProfileInput): Promise<SessionState>;
  };
  readonly settings: {
    changeProductionPassword(input: ChangeProductionPasswordInput): Promise<OperationResult>;
  };
  readonly receipts: ReceiptApi;
  readonly backups: {
    getState(): Promise<BackupState>;
    chooseDestination(): Promise<BackupState>;
    createManual(): Promise<BackupRecord>;
    importBackup(): Promise<RestoreBackupResult>;
    verify(input: VerifyBackupInput): Promise<BackupRecord>;
  };
  readonly inventory: InventoryApi;
  readonly combos: ComboApi;
  readonly operations: OperationsApi;
  readonly vouchers: VoucherApi;
  readonly cash: CashApi;
  readonly expenses: ExpenseApi;
  readonly tickets: TicketApi;
}
