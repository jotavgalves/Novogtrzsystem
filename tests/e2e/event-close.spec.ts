import path from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';
import { _electron as electron } from 'playwright';

const applicationPath = path.join(process.cwd(), 'apps', 'desktop');

type CloseOutcome = 'success' | 'failure' | 'pending';

async function ensureProduction(window: Page): Promise<void> {
  if (await window.getByText('Caixa', { exact: true }).isVisible()) {
    await window.getByPlaceholder('Digite a senha').fill('121225');
    await window.getByRole('button', { name: 'Entrar em Produção' }).click();
    await expect(window.getByText('Produção', { exact: true })).toBeVisible();
  }
}

async function waitForCloseOutcome(
  window: Page,
  closedStatus: Locator,
  failureMessage: Locator,
): Promise<CloseOutcome> {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (await closedStatus.isVisible()) {
      return 'success';
    }

    if (await failureMessage.isVisible()) {
      return 'failure';
    }

    await window.waitForTimeout(200);
  }

  return 'pending';
}

test('SMK-END-001 — concilia, gera backup e encerra o evento', async () => {
  test.setTimeout(90_000);
  const electronApplication = await electron.launch({ args: [applicationPath] });

  try {
    const window = await electronApplication.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await ensureProduction(window);
    const eventName = `Evento encerramento ${String(Date.now())}`;

    await window.getByRole('link', { name: 'Eventos' }).click();
    await window.getByPlaceholder('Ex.: La Rumba Neon — Agosto').fill(eventName);
    await window.getByRole('button', { name: 'Criar evento' }).click();
    const eventCard = window.locator('article.event-card').filter({ hasText: eventName });
    await expect(eventCard).toBeVisible();

    const operateButton = eventCard.getByRole('button', { name: 'Operar evento' });
    if (await operateButton.isVisible()) {
      await operateButton.click();
      await expect(eventCard.getByText('Em operação')).toBeVisible();
    }

    await window.getByRole('link', { name: 'Caixa' }).click();
    await window.getByLabel('Saldo de abertura').fill('100.00');
    await window.getByRole('button', { name: 'Abrir caixa' }).click();
    await expect(window.getByText('Caixa aberto.')).toBeVisible();

    await window.getByRole('link', { name: 'Eventos' }).click();
    await eventCard.getByRole('button', { name: 'Encerrar', exact: true }).click();
    const closePanel = window.locator('.event-close-panel');
    await expect(closePanel.getByRole('heading', { name: eventName })).toBeVisible();
    await expect(closePanel).toContainText('R$ 100,00');
    await closePanel.getByPlaceholder('0,00').fill('100,00');
    await closePanel.getByRole('checkbox').check();
    const closeButton = closePanel.getByRole('button', { name: 'Encerrar evento com backup' });
    await closeButton.click();
    await expect(
      closePanel.getByRole('button', { name: 'Encerrando e verificando backup…' }),
    ).toBeVisible();

    const closedStatus = eventCard.getByText('Encerrado', { exact: true });
    const failureMessage = window.locator('.event-close-panel .form-error');
    const outcome = await waitForCloseOutcome(window, closedStatus, failureMessage);

    if (outcome === 'failure') {
      const failureText = (await failureMessage.textContent()) ?? 'erro não informado';
      throw new Error(`Encerramento rejeitado pelo sistema: ${failureText}`);
    }

    if (outcome === 'pending') {
      throw new Error('O evento não foi encerrado e o sistema não exibiu uma mensagem de erro.');
    }

    await expect(closedStatus).toBeVisible();
    await expect(window.getByText('Nenhum', { exact: true }).first()).toBeVisible();
  } finally {
    await electronApplication.close();
  }
});
