import { ipcRenderer } from 'electron';

import {
  auditQueryInputSchema,
  auditStateSchema,
  dashboardStateSchema,
  IPC_CHANNELS,
  type AuditApi,
  type DashboardApi,
} from '@gtrz/contracts';

export const dashboardApi: DashboardApi = {
  async getState() {
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.dashboardGetState);
    return dashboardStateSchema.parse(payload);
  },
};

export const auditApi: AuditApi = {
  async list(input = { limit: 100, offset: 0 }) {
    const parsedInput = auditQueryInputSchema.parse(input);
    const payload: unknown = await ipcRenderer.invoke(IPC_CHANNELS.auditList, parsedInput);
    return auditStateSchema.parse(payload);
  },
};
