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

test('SMK-DASH-002 — exibe equilibrio por produto e valor potencial do estoque', async () => {
  const electronApplication = await electron.launch({ args: [applicationPath] });

  try {
    const window = await electronApplication.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await ensureProduction(window);
    const suffix = String(Date.now());
    const eventName = `Evento previsão ${suffix}`;
    const categoryName = `Bebidas previsão ${suffix}`;
    const productName = `Coca previsão ${suffix}`;

    await window.getByRole('link', { name: 'Eventos' }).click();
    await window.getByPlaceholder('Ex.: La Rumba Neon — Agosto').fill(eventName);
    await window.getByRole('button', { name: 'Criar evento' }).click();
    const eventCard = window.locator('article.event-card').filter({ hasText: eventName });
    await eventCard.getByRole('button', { name: 'Operar evento' }).click();

    await window.getByRole('link', { name: 'Estoque' }).click();
    await window.getByPlaceholder('Ex.: Cervejas').fill(categoryName);
    await window.getByRole('button', { name: 'Criar categoria' }).click();
    const productForm = window.locator('form.product-form');
    await productForm.getByLabel('Nome', { exact: true }).fill(productName);
    await productForm.getByRole('combobox').first().selectOption({ label: categoryName });
    await productForm.getByLabel('Preço de custo', { exact: true }).fill('2.00');
    await productForm.getByLabel('Preço de venda', { exact: true }).fill('5.00');
    await productForm.getByLabel('Aviso de estoque baixo', { exact: true }).fill('5');
    await productForm.getByRole('button', { name: 'Cadastrar produto' }).click();

    const productCard = window.locator('article.inventory-card').filter({ hasText: productName });
    await productCard.getByRole('button', { name: 'Movimentar' }).click();
    const movementForm = window.locator('form.movement-form');
    await movementForm.getByLabel('Quantidade', { exact: true }).fill('30');
    await movementForm.getByRole('button', { name: 'Registrar movimento' }).click();

    await window.getByRole('link', { name: 'Visão geral' }).click();
    await expect(window.getByRole('heading', { name: 'Valor previsto do estoque' })).toBeVisible();
    const forecast = window.locator('article.inventory-value-panel');
    await expect(forecast).toContainText('30');
    await expect(forecast).toContainText('R$ 150,00');
    await expect(forecast).toContainText('R$ 60,00');

    const breakEvenPanel = window.locator('article.inventory-break-even-panel');
    const productRow = breakEvenPanel.locator('.inventory-break-even-row').filter({
      hasText: productName,
    });
    await expect(productRow).toContainText(categoryName);
    await expect(productRow).toContainText('30 compradas');
    await expect(productRow).toContainText('12 un.');
  } finally {
    await electronApplication.close();
  }
});
