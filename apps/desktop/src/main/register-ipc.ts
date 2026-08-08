import { app, ipcMain } from 'electron';

import {
  backupRecordSchema,
  backupStateSchema,
  changeEventStatusInputSchema,
  changeProductionPasswordInputSchema,
  createEventInputSchema,
  deleteEventInputSchema,
  eventListSchema,
  eventSchema,
  IPC_CHANNELS,
  operationResultSchema,
  renameEventInputSchema,
  restoreBackupResultSchema,
  sessionStateSchema,
  setActiveEventInputSchema,
  switchProfileInputSchema,
  systemInfoSchema,
  verifyBackupInputSchema,
  type SystemInfo,
} from '@gtrz/contracts';
import {
  changeEventStatus,
  changeProductionPassword,
  createEvent,
  deleteEvent,
  getSessionState,
  listEvents,
  renameEvent,
  setActiveEvent,
  switchProfile,
  type DatabaseContext,
} from '@gtrz/database';

import type { BackupService } from './backup-service';
import { failIpcOperation, handleIpc } from './ipc-handler';
import { registerComboIpcHandlers } from './register-combo-ipc';
import { registerEventCloseIpcHandlers } from './register-event-close-ipc';
import { registerFinanceIpcHandlers } from './register-finance-ipc';
import { registerInsightsIpcHandlers } from './register-insights-ipc';
import { registerInventoryIpcHandlers } from './register-inventory-ipc';
import { registerOperationsIpcHandlers } from './register-operations-ipc';
import { registerTicketIpcHandlers } from './register-ticket-ipc';
import { registerVoucherIpcHandlers } from './register-voucher-ipc';

interface RegisterIpcOptions {
  readonly getDatabase: () => DatabaseContext;
  readonly databaseReady: () => boolean;
  readonly backupService: BackupService;
}

const CONTROL_CHANNELS = [
  IPC_CHANNELS.systemGetInfo,
  IPC_CHANNELS.eventsList,
  IPC_CHANNELS.eventsCreate,
  IPC_CHANNELS.eventsRename,
  IPC_CHANNELS.eventsChangeStatus,
  IPC_CHANNELS.eventsDelete,
  IPC_CHANNELS.eventsSetActive,
  IPC_CHANNELS.sessionGetState,
  IPC_CHANNELS.sessionSwitchProfile,
  IPC_CHANNELS.settingsChangeProductionPassword,
  IPC_CHANNELS.backupsGetState,
  IPC_CHANNELS.backupsChooseDestination,
  IPC_CHANNELS.backupsCreateManual,
  IPC_CHANNELS.backupsImport,
  IPC_CHANNELS.backupsVerify,
] as const;

export function registerIpcHandlers(options: RegisterIpcOptions): void {
  for (const channel of CONTROL_CHANNELS) {
    ipcMain.removeHandler(channel);
  }

  handleIpc(IPC_CHANNELS.systemGetInfo, (): SystemInfo => {
    return systemInfoSchema.parse({
      appName: 'GTRZ System',
      version: app.getVersion(),
      platform: process.platform,
      databaseReady: options.databaseReady(),
    });
  });

  handleIpc(IPC_CHANNELS.eventsList, () => {
    return eventListSchema.parse(listEvents(options.getDatabase()));
  });

  handleIpc(IPC_CHANNELS.eventsCreate, (_event, payload: unknown) => {
    const input = createEventInputSchema.parse(payload);
    const database = options.getDatabase();
    const hadActiveEvent = getSessionState(database).activeEvent !== null;
    const created = createEvent(database, input);

    if (!hadActiveEvent) {
      setActiveEvent(database, null);
    }

    return eventSchema.parse(created);
  });

  handleIpc(IPC_CHANNELS.eventsRename, (_event, payload: unknown) => {
    const input = renameEventInputSchema.parse(payload);
    return eventSchema.parse(renameEvent(options.getDatabase(), input));
  });

  handleIpc(IPC_CHANNELS.eventsChangeStatus, (_event, payload: unknown) => {
    const input = changeEventStatusInputSchema.parse(payload);
    const database = options.getDatabase();
    const current = listEvents(database).find((event) => event.id === input.eventId);

    if (current?.status === 'open' && input.status === 'closed') {
      failIpcOperation(
        'INVALID_STATE',
        'Use o encerramento integrado para conciliar o caixa e gerar o backup final.',
        { eventId: input.eventId, requestedStatus: input.status },
      );
    }

    return eventSchema.parse(changeEventStatus(database, input));
  });

  handleIpc(IPC_CHANNELS.eventsDelete, (_event, payload: unknown) => {
    const input = deleteEventInputSchema.parse(payload);
    deleteEvent(options.getDatabase(), input);
    return operationResultSchema.parse({ success: true });
  });

  handleIpc(IPC_CHANNELS.eventsSetActive, (_event, payload: unknown) => {
    const input = setActiveEventInputSchema.parse(payload);
    return sessionStateSchema.parse(setActiveEvent(options.getDatabase(), input.eventId));
  });

  handleIpc(IPC_CHANNELS.sessionGetState, () => {
    return sessionStateSchema.parse(getSessionState(options.getDatabase()));
  });

  handleIpc(IPC_CHANNELS.sessionSwitchProfile, (_event, payload: unknown) => {
    const input = switchProfileInputSchema.parse(payload);
    return sessionStateSchema.parse(
      switchProfile(options.getDatabase(), input.targetProfile, input.password),
    );
  });

  handleIpc(IPC_CHANNELS.settingsChangeProductionPassword, (_event, payload: unknown) => {
    const input = changeProductionPasswordInputSchema.parse(payload);
    changeProductionPassword(options.getDatabase(), input.currentPassword, input.newPassword);
    return operationResultSchema.parse({ success: true });
  });

  handleIpc(IPC_CHANNELS.backupsGetState, async () => {
    return backupStateSchema.parse(await options.backupService.getState());
  });

  handleIpc(IPC_CHANNELS.backupsChooseDestination, async () => {
    return backupStateSchema.parse(await options.backupService.chooseDestination());
  });

  handleIpc(IPC_CHANNELS.backupsCreateManual, async () => {
    return backupRecordSchema.parse(await options.backupService.createBackup('manual'));
  });

  handleIpc(IPC_CHANNELS.backupsImport, async () => {
    return restoreBackupResultSchema.parse(await options.backupService.importBackup());
  });

  handleIpc(IPC_CHANNELS.backupsVerify, async (_event, payload: unknown) => {
    const input = verifyBackupInputSchema.parse(payload);
    return backupRecordSchema.parse(await options.backupService.verify(input.filePath));
  });

  registerInsightsIpcHandlers({ getDatabase: options.getDatabase });
  registerInventoryIpcHandlers({ getDatabase: options.getDatabase });
  registerComboIpcHandlers({ getDatabase: options.getDatabase });
  registerEventCloseIpcHandlers({
    getDatabase: options.getDatabase,
    backupService: options.backupService,
  });
  registerFinanceIpcHandlers({ getDatabase: options.getDatabase });
  registerOperationsIpcHandlers({ getDatabase: options.getDatabase });
  registerTicketIpcHandlers({ getDatabase: options.getDatabase });
  registerVoucherIpcHandlers({ getDatabase: options.getDatabase });
}
