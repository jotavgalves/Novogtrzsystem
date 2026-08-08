import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';
import { _electron as electron } from 'playwright';

const applicationPath = path.join(process.cwd(), 'apps', 'desktop');

async function ensureProduction(window: Page): Promise<void> {
  if (await window.getByText('Caixa', { exact: true }).isVisible()) {
    await window.getByPlaceholder('Digite a senha').fill('121225');
    await window.getByRole('button', { name: 'Entrar em Produção' }).click();
  }
}

test('SMK-PRINT-001 — configura impressao automatica e largura da nota', async () => {
  const electronApplication = await electron.launch({ args: [applicationPath] });

  try {
    const window = await electronApplication.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await ensureProduction(window);
    await window.getByRole('link', { name: 'Configurações' }).click();

    await expect(window.getByRole('heading', { name: 'Impressão térmica' })).toBeVisible();
    const autoPrint = window.getByRole('checkbox', {
      name: /Imprimir automaticamente ao concluir venda/u,
    });
    await expect(autoPrint).toBeVisible();
    await autoPrint.uncheck();
    await window.getByLabel('Largura do papel').selectOption('80');
    await window.getByRole('button', { name: 'Salvar impressão' }).click();
    await expect(window.getByText('Configuração de impressão salva.')).toBeVisible();

    await window.getByRole('link', { name: 'Visão geral' }).click();
    await window.getByRole('link', { name: 'Configurações' }).click();
    await expect(window.getByLabel('Largura do papel')).toHaveValue('80');
    await expect(autoPrint).not.toBeChecked();
  } finally {
    await electronApplication.close();
  }
});
