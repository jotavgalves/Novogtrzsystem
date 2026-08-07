import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';
import { _electron as electron } from 'playwright';

import { closeElectronApplication } from './electron-app';

const applicationPath = path.join(process.cwd(), 'apps', 'desktop');

test.setTimeout(60_000);

async function ensureProduction(window: Page): Promise<void> {
  const passwordInput = window.getByPlaceholder('Digite a senha');

  if (await passwordInput.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await passwordInput.fill('121225');
    await window.getByRole('button', { name: 'Entrar em Produção' }).click();
    await expect(window.getByText('Produção', { exact: true })).toBeVisible();
  }
}

test('SMK-FIN-001 — concilia despesa, suprimento e diferença de caixa', async () => {
  const electronApplication = await electron.launch({ args: [applicationPath] });

  try {
    const window = await electronApplication.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await ensureProduction(window);
    const suffix = String(Date.now());
    const eventName = `Evento financeiro ${suffix}`;

    await window.getByRole('link', { name: 'Eventos' }).click();
    await window.getByPlaceholder('Ex.: La Rumba Neon — Agosto').fill(eventName);
    await window.getByRole('button', { name: 'Criar evento' }).click();
    const eventCard = window.locator('article.event-card').filter({ hasText: eventName });
    await expect(eventCard).toBeVisible();
    const operateButton = eventCard.getByRole('button', { name: 'Operar evento' });
    if (await operateButton.isVisible()) {
      await operateButton.click();
    }

    await window.getByRole('link', { name: 'Caixa' }).click();
    await expect(window.getByRole('heading', { name: 'Caixa administrativo' })).toBeVisible();
    await window.getByLabel('Saldo de abertura').fill('100,00');
    await window.getByRole('button', { name: 'Abrir caixa' }).click();
    await expect(window.getByText('Caixa aberto.')).toBeVisible();
    await expect(window.getByText('R$ 100,00', { exact: true }).first()).toBeVisible();

    await window.getByRole('link', { name: 'Despesas' }).click();
    await window.getByPlaceholder('Ex.: Estrutura').fill('Operação');
    await window.getByPlaceholder('Ex.: Locação de gerador').fill('Compra de gelo');
    await window.getByLabel('Valor total').fill('20,00');
    await window.getByLabel('Pago agora').fill('20,00');
    await window.getByLabel('Forma de pagamento').selectOption('cash');
    await window.getByRole('button', { name: 'Registrar despesa' }).click();
    await expect(window.getByText('Despesa registrada.')).toBeVisible();
    await expect(window.getByText('R$ 20,00', { exact: true }).first()).toBeVisible();

    await window.getByRole('link', { name: 'Caixa' }).click();
    await expect(window.getByText('R$ 80,00', { exact: true }).first()).toBeVisible();
    await window.getByLabel('Tipo').selectOption('supply');
    await window.getByLabel('Valor', { exact: true }).fill('10,00');
    await window.getByPlaceholder('Ex.: reforço de troco').fill('Troco adicional');
    await window.getByRole('button', { name: 'Registrar' }).click();
    await expect(window.getByText('Suprimento registrado.')).toBeVisible();
    await expect(window.getByText('R$ 90,00', { exact: true }).first()).toBeVisible();

    await window.getByLabel('Dinheiro contado').fill('85,00');
    await window.getByRole('button', { name: 'Fechar caixa' }).click();
    await expect(window.getByText('Caixa fechado.')).toBeVisible();
    await expect(window.getByText('Caixa encerrado')).toBeVisible();
    await expect(window.getByText('-R$ 5,00', { exact: true })).toBeVisible();
  } finally {
    await closeElectronApplication(electronApplication);
  }
});
