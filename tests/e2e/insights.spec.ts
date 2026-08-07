import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';
import { _electron as electron } from 'playwright';

const applicationPath = path.join(process.cwd(), 'apps', 'desktop');

async function ensureProduction(window: Page): Promise<void> {
  if (await window.getByText('Caixa', { exact: true }).isVisible()) {
    await window.getByPlaceholder('Digite a senha').fill('121225');
    await window.getByRole('button', { name: 'Entrar em Produção' }).click();
    await expect(window.getByText('Produção', { exact: true })).toBeVisible();
  }
}

test('SMK-INS-001 — consolida evento e pesquisa sua trilha de auditoria', async () => {
  test.setTimeout(60_000);
  const electronApplication = await electron.launch({ args: [applicationPath] });

  try {
    const window = await electronApplication.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await ensureProduction(window);
    const eventName = `Evento indicadores ${String(Date.now())}`;

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

    await window.getByRole('link', { name: 'Visão geral' }).click();
    const main = window.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
    await expect(main.getByText(eventName, { exact: true })).toBeVisible();
    await expect(main.getByText('Faturamento', { exact: true })).toBeVisible();
    await expect(main.getByText('Resultado projetado', { exact: true })).toBeVisible();

    await window.getByRole('link', { name: 'Auditoria' }).click();
    await expect(main.getByRole('heading', { name: 'Auditoria' })).toBeVisible();
    const searchInput = main.getByPlaceholder('Ex.: estorno, ingresso, nome do evento');
    await searchInput.fill(eventName);
    await main.getByRole('button', { name: 'Aplicar filtros' }).click();
    const createdAuditCard = main
      .locator('article.audit-card')
      .filter({ hasText: eventName })
      .filter({ hasText: 'event.created' });
    await expect(createdAuditCard).toHaveCount(1);
    await expect(createdAuditCard).toBeVisible();
  } finally {
    await electronApplication.close();
  }
});
