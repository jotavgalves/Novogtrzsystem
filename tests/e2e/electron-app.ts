import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import { expect, type Page } from '@playwright/test';
import { _electron as electron, type ElectronApplication } from 'playwright';

const execFileAsync = promisify(execFile);
const applicationPath = path.join(process.cwd(), 'apps', 'desktop');
const cleanupTimeout = 5_000;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function terminateProcessTree(processId: number): Promise<void> {
  try {
    if (process.platform === 'win32') {
      await execFileAsync('taskkill', ['/PID', String(processId), '/T', '/F']);
      return;
    }

    process.kill(processId, 'SIGKILL');
  } catch {
    // O processo pode ter encerrado entre a verificação e a tentativa de finalização.
  }
}

export async function launchElectronApplication(): Promise<ElectronApplication> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await electron.launch({ args: [applicationPath] });
    } catch (error: unknown) {
      lastError = error;

      if (attempt < 3) {
        await delay(1_000 * attempt);
      }
    }
  }

  throw lastError;
}

export async function closeElectronApplication(application: ElectronApplication): Promise<void> {
  const childProcess = application.process();
  const processId = childProcess.pid;
  let exited = childProcess.exitCode !== null;
  const exitPromise = new Promise<void>((resolve) => {
    if (exited) {
      resolve();
      return;
    }

    childProcess.once('exit', () => {
      exited = true;
      resolve();
    });
  });

  await Promise.race([application.close().catch(() => undefined), delay(cleanupTimeout)]);

  if (!exited && processId !== undefined) {
    await terminateProcessTree(processId);
  }

  await Promise.race([exitPromise, delay(cleanupTimeout)]);
  await delay(300);
}

export async function ensureProduction(window: Page): Promise<void> {
  if (await window.getByText('Caixa', { exact: true }).isVisible()) {
    await window.getByPlaceholder('Digite a senha').fill('121225');
    await window.getByRole('button', { name: 'Entrar em Produção' }).click();
    await expect(window.getByText('Produção', { exact: true })).toBeVisible();
  }
}
