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

test('SMK-OPR-001 — vende, estorna e devolve o estoque pela interface', async () => {
  const electronApplication = await electron.launch({ args: [applicationPath] });

  try {
    const window = await electronApplication.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await ensureProduction(window);
    const suffix = String(Date.now());
    const eventName = `Evento operação ${suffix}`;
    const categoryName = `Operação ${suffix}`;
    const productName = `Água venda ${suffix}`;
    const tableName = `Mesa ${suffix.slice(-4)}`;

    await window.getByRole('link', { name: 'Eventos' }).click();
    await window.getByPlaceholder('Ex.: La Rumba Neon — Agosto').fill(eventName);
    await window.getByRole('button', { name: 'Criar evento' }).click();
    await expect(window.getByText(eventName, { exact: true }).first()).toBeVisible();

    await window.getByRole('link', { name: 'Estoque' }).click();
    await window.getByPlaceholder('Ex.: Cervejas').fill(categoryName);
    await window.getByRole('button', { name: 'Criar categoria' }).click();

    const productForm = window.locator('form.product-form');
    await productForm.getByLabel('Nome', { exact: true }).fill(productName);
    await productForm.getByRole('combobox').first().selectOption({ label: categoryName });
    await productForm.getByLabel('Preço de custo', { exact: true }).fill('2.00');
    await productForm.getByLabel('Preço de venda', { exact: true }).fill('10.00');
    await productForm.getByLabel('Aviso de estoque baixo', { exact: true }).fill('1');
    await productForm.getByRole('button', { name: 'Cadastrar produto' }).click();

    let productCard = window.locator('article.inventory-card').filter({ hasText: productName });
    await productCard.getByRole('button', { name: 'Movimentar' }).click();
    const movementForm = window.locator('form.movement-form');
    await movementForm.getByLabel('Quantidade', { exact: true }).fill('5');
    await movementForm.getByRole('button', { name: 'Registrar movimento' }).click();
    await expect(productCard.getByText('5 un.', { exact: true })).toBeVisible();

    await window.getByRole('link', { name: 'Mesas e balcão' }).click();
    await expect(window.getByRole('heading', { name: 'Mesas e balcão' })).toBeVisible();
    await window.getByPlaceholder('Ex.: Mesa 12').fill(tableName);
    await window.getByRole('button', { name: 'Criar mesa' }).click();

    const tableButton = window.getByRole('button', { name: new RegExp(tableName, 'u') });
    await expect(tableButton).toBeVisible();
    await tableButton.click();

    const catalogItem = window.getByRole('button', { name: new RegExp(productName, 'u') });
    await expect(catalogItem).toBeVisible();
    await catalogItem.click();
    await expect(window.getByText(productName, { exact: true }).last()).toBeVisible();
    await expect(window.getByText('R$ 10,00', { exact: true }).last()).toBeVisible();

    await window.getByLabel('Valor do pagamento 1').fill('10.00');
    await window.getByLabel('Valor recebido 1').fill('20.00');
    await window.getByRole('button', { name: 'Concluir venda' }).click();
    await expect(window.getByText('Venda concluída e estoque atualizado.')).toBeVisible();
    await expect(window.getByRole('button', { name: new RegExp(tableName, 'u') })).toContainText(
      'Livre',
    );

    await window.getByRole('link', { name: 'Estoque' }).click();
    productCard = window.locator('article.inventory-card').filter({ hasText: productName });
    await expect(productCard.getByText('4 un.', { exact: true })).toBeVisible();

    await window.getByRole('link', { name: 'Mesas e balcão' }).click();
    const recentOrder = window.locator('article.recent-order-card').filter({ hasText: tableName });
    await expect(recentOrder).toContainText('Paga');
    await recentOrder.getByPlaceholder('Ex.: lançamento duplicado').fill('Pagamento duplicado');
    await recentOrder.getByRole('button', { name: 'Estornar venda' }).click();
    await expect(window.getByText('Comanda cancelada e operação auditada.')).toBeVisible();
    await expect(recentOrder).toContainText('Cancelada');

    await window.getByRole('link', { name: 'Estoque' }).click();
    productCard = window.locator('article.inventory-card').filter({ hasText: productName });
    await expect(productCard.getByText('5 un.', { exact: true })).toBeVisible();
  } finally {
    await electronApplication.close();
  }
});
