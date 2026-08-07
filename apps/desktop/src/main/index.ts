import { app, BrowserWindow, dialog } from 'electron';
import path from 'node:path';

import { BackupService } from './backup-service';
import { createMainWindow } from './create-main-window';
import { DatabaseRuntime } from './database-runtime';
import { registerIpcHandlers } from './register-ipc';

let mainWindow: BrowserWindow | null = null;
let databaseRuntime: DatabaseRuntime | null = null;

const hasSingleInstanceLock = app.requestSingleInstanceLock();

function requireDatabaseRuntime(): DatabaseRuntime {
  if (databaseRuntime === null) {
    throw new Error('O banco local ainda não foi inicializado.');
  }

  return databaseRuntime;
}

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow === null) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  });

  void app.whenReady().then(async () => {
    try {
      const userDataPath = app.getPath('userData');
      const databasePath = path.join(userDataPath, 'gtrz-system.sqlite');
      databaseRuntime = new DatabaseRuntime(databasePath);
      const backupService = new BackupService({
        appVersion: app.getVersion(),
        defaultDestinationPath: path.join(app.getPath('documents'), 'GTRZ System', 'Backups'),
        settingsPath: path.join(userDataPath, 'backup-settings.json'),
        databaseRuntime,
      });

      registerIpcHandlers({
        getDatabase: () => requireDatabaseRuntime().get(),
        databaseReady: () => requireDatabaseRuntime().isReady(),
        backupService,
      });

      await backupService.createBackup('automatic').catch(() => undefined);
      mainWindow = createMainWindow();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Falha desconhecida na inicialização.';
      dialog.showErrorBox('GTRZ System não pôde iniciar', message);
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });

  app.on('before-quit', () => {
    databaseRuntime?.close();
    databaseRuntime = null;
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
