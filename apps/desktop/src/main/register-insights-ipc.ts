import { ipcMain } from 'electron';

import {
  auditQueryInputSchema,
  auditStateSchema,
  dashboardStateSchema,
  IPC_CHANNELS,
} from '@gtrz/contracts';
import {
  getAuditState,
  getDashboardState,
  type DatabaseAuditQuery,
  type DatabaseContext,
} from '@gtrz/database';

interface RegisterInsightsIpcOptions {
  readonly getDatabase: () => DatabaseContext;
}

const INSIGHT_CHANNELS = [IPC_CHANNELS.dashboardGetState, IPC_CHANNELS.auditList] as const;

export function registerInsightsIpcHandlers(options: RegisterInsightsIpcOptions): void {
  for (const channel of INSIGHT_CHANNELS) {
    ipcMain.removeHandler(channel);
  }

  ipcMain.handle(IPC_CHANNELS.dashboardGetState, () => {
    return dashboardStateSchema.parse(getDashboardState(options.getDatabase()));
  });

  ipcMain.handle(IPC_CHANNELS.auditList, (_event, payload: unknown) => {
    const input = auditQueryInputSchema.parse(payload ?? {});
    const databaseInput: DatabaseAuditQuery = {
      limit: input.limit,
      offset: input.offset,
      ...(input.eventId === undefined ? {} : { eventId: input.eventId }),
      ...(input.profile === undefined ? {} : { profile: input.profile }),
      ...(input.action === undefined ? {} : { action: input.action }),
      ...(input.entityType === undefined ? {} : { entityType: input.entityType }),
      ...(input.entityId === undefined ? {} : { entityId: input.entityId }),
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
      ...(input.search === undefined ? {} : { search: input.search }),
      ...(input.from === undefined ? {} : { from: input.from }),
      ...(input.to === undefined ? {} : { to: input.to }),
    };
    return auditStateSchema.parse(getAuditState(options.getDatabase(), databaseInput));
  });
}
