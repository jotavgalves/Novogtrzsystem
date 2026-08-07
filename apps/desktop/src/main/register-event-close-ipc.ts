import { ipcMain } from 'electron';

import {
  completeEventCloseInputSchema,
  eventClosePreviewInputSchema,
  eventCloseResultSchema,
  eventCloseSummarySchema,
  IPC_CHANNELS,
} from '@gtrz/contracts';
import {
  appendAudit,
  changeEventStatus,
  closeCashRegister,
  previewEventClose,
  type DatabaseContext,
} from '@gtrz/database';

import type { BackupService } from './backup-service';
import { failIpcOperation, handleIpc } from './ipc-handler';

interface RegisterEventCloseIpcOptions {
  readonly getDatabase: () => DatabaseContext;
  readonly backupService: BackupService;
}

export function registerEventCloseIpcHandlers(options: RegisterEventCloseIpcOptions): void {
  ipcMain.removeHandler(IPC_CHANNELS.eventClosePreview);
  ipcMain.removeHandler(IPC_CHANNELS.eventCloseComplete);

  handleIpc(IPC_CHANNELS.eventClosePreview, (_event, payload: unknown) => {
    const input = eventClosePreviewInputSchema.parse(payload);
    return eventCloseSummarySchema.parse(previewEventClose(options.getDatabase(), input.eventId));
  });

  handleIpc(IPC_CHANNELS.eventCloseComplete, async (_event, payload: unknown) => {
    const input = completeEventCloseInputSchema.parse(payload);
    const database = options.getDatabase();
    const initial = previewEventClose(database, input.eventId);

    if (!initial.canClose) {
      failIpcOperation('INVALID_STATE', initial.blockers.join(' '), {
        eventId: input.eventId,
        blockers: initial.blockers,
      });
    }

    if (initial.requiresCashCount) {
      if (input.countedCashCents === undefined) {
        failIpcOperation(
          'VALIDATION_ERROR',
          'Informe o valor contado para conciliar e fechar o caixa.',
          { field: 'countedCashCents' },
        );
      }

      closeCashRegister(database, input.countedCashCents);
    }

    const summary = previewEventClose(database, input.eventId);

    if (!summary.canClose || summary.requiresCashCount) {
      failIpcOperation(
        'INVALID_STATE',
        'O caixa não foi conciliado corretamente. Revise o fechamento antes de tentar novamente.',
        { eventId: input.eventId },
      );
    }

    const backup = await options.backupService.createBackup('event-close');
    const event = changeEventStatus(database, { eventId: input.eventId, status: 'closed' });

    appendAudit(database, {
      action: 'event.close-completed',
      entityType: 'event',
      entityId: input.eventId,
      eventId: input.eventId,
      details: {
        backupFileName: backup.fileName,
        grossSalesCents: summary.grossSalesCents,
        activeExpensesCents: summary.activeExpensesCents,
        projectedResultCents: summary.projectedResultCents,
        expectedCashCents: summary.expectedCashCents,
        countedCashCents: summary.countedCashCents,
        varianceCents: summary.varianceCents,
        paidOrdersCount: summary.paidOrdersCount,
        ticketSoldQuantity: summary.ticketSoldQuantity,
        ticketCourtesyQuantity: summary.ticketCourtesyQuantity,
      },
    });

    return eventCloseResultSchema.parse({ event, summary, backup });
  });
}
