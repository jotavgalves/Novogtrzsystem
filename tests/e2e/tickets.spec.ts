import { expect, test } from '@playwright/test';

import {
  closeElectronApplication,
  ensureProduction,
  launchElectronApplication,
} from './electron-app';

const actionTimeout = 5_000;

test('SMK-TKT-001 — vende, cancela e exclui registros de ingresso com segurança', async () => {
  test.setTimeout(60_000);
  const electronApplication = await launchElectronApplication();

  try {
    const window = await electronApplication.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await ensureProduction(window);
    const suffix = String(Date.now());
    const eventName = `Evento ingresso ${suffix}`;
    const lotName = `Lote ${suffix.slice(-6)}`;
    const attendeeName = `Grupo ${suffix.slice(-6)}`;

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

    await window.getByRole('link', { name: 'Ingressos' }).click();
    await expect(window.getByRole('heading', { name: 'Ingressos', exact: true })).toBeVisible();
    await window.getByPlaceholder('Ex.: Segundo lote').fill(lotName);
    await window.getByPlaceholder('60,00').fill('50.00');
    await window.getByPlaceholder('200').fill('3');
    await window.getByRole('button', { name: 'Criar lote', exact: true }).click();
    await expect(window.getByText('Lote criado.')).toBeVisible();

    const saleForm = window.locator('form.ticket-sale-form');
    const saleComboboxes = saleForm.getByRole('combobox');
    const lotSelect = saleComboboxes.nth(0);
    await expect(lotSelect.locator('option')).toHaveCount(2, { timeout: actionTimeout });
    await lotSelect.selectOption({ index: 1 }, { timeout: actionTimeout });
    await saleForm.getByPlaceholder('Nome completo').fill(attendeeName, {
      timeout: actionTimeout,
    });
    await saleComboboxes.nth(1).selectOption('door', { timeout: actionTimeout });
    await saleForm.getByRole('spinbutton').fill('2', { timeout: actionTimeout });
    await saleComboboxes.nth(2).selectOption('cash', { timeout: actionTimeout });
    const registerSaleButton = saleForm.getByRole('button', {
      name: 'Registrar venda',
      exact: true,
    });
    await expect(registerSaleButton).toBeEnabled({ timeout: actionTimeout });
    await registerSaleButton.click({ timeout: actionTimeout });
    await expect(window.getByText('Ingressos registrados.')).toBeVisible({
      timeout: actionTimeout,
    });

    let saleCard = window.locator('article.ticket-sale-card').filter({ hasText: attendeeName });
    await expect(saleCard).toContainText('R$ 100,00');
    await expect(saleCard.locator('.ticket-code')).toHaveCount(2);
    let lotCard = window.locator('article.ticket-lot-card').filter({ hasText: lotName });
    await expect(lotCard).toContainText('1');

    await window.getByRole('link', { name: 'Caixa' }).click();
    await expect(window.getByText('R$ 100,00', { exact: true }).first()).toBeVisible();

    await window.getByRole('link', { name: 'Ingressos' }).click();
    saleCard = window.locator('article.ticket-sale-card').filter({ hasText: attendeeName });
    await saleCard.getByPlaceholder('Ex.: venda duplicada').fill('Venda duplicada');
    const cancelSaleButton = saleCard.getByRole('button', {
      name: 'Cancelar venda',
      exact: true,
    });
    await expect(cancelSaleButton).toBeEnabled({ timeout: actionTimeout });
    await cancelSaleButton.click({ timeout: actionTimeout });
    await expect(window.getByText('Venda cancelada.')).toBeVisible({
      timeout: actionTimeout,
    });
    await expect(saleCard).toContainText('Cancelada');
    lotCard = window.locator('article.ticket-lot-card').filter({ hasText: lotName });
    await expect(lotCard).toContainText('3');

    await window.getByRole('link', { name: 'Caixa' }).click();
    await expect(window.getByText('R$ 0,00', { exact: true }).first()).toBeVisible();

    await window.getByRole('link', { name: 'Ingressos' }).click();
    saleCard = window.locator('article.ticket-sale-card').filter({ hasText: attendeeName });
    await saleCard.getByPlaceholder('Motivo da exclusão definitiva').fill('Limpar venda de teste');
    await saleCard.getByRole('button', { name: 'Excluir registro' }).click();
    await expect(window.getByText('Registro excluído.')).toBeVisible();
    await expect(
      window.locator('article.ticket-sale-card').filter({ hasText: attendeeName }),
    ).toHaveCount(0);

    lotCard = window.locator('article.ticket-lot-card').filter({ hasText: lotName });
    await lotCard.getByRole('button', { name: 'Excluir', exact: true }).click();
    await lotCard.getByLabel(`Motivo para excluir lote ${lotName}`).fill('Limpar lote de teste');
    await lotCard.getByRole('button', { name: 'Excluir lote' }).click();
    await expect(window.getByText('Lote excluído.')).toBeVisible();
    await expect(
      window.locator('article.ticket-lot-card').filter({ hasText: lotName }),
    ).toHaveCount(0);
  } finally {
    await closeElectronApplication(electronApplication);
  }
});
