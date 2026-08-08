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

test('SMK-OPR-001 — vende, mantém histórico na mesa, estorna e devolve o estoque', async () => {
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
    const eventCard = window.locator('article.event-card').filter({ hasText: eventName });
    await expect(eventCard).toBeVisible();
    await expect(eventCard.getByRole('button', { name: 'Operar evento' })).toBeVisible();
    await eventCard.getByRole('button', { name: 'Operar evento' }).click();
    await expect(eventCard.getByText('Em operação')).toBeVisible();

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

    const tableButton = window.locator('button.service-point-card').filter({ hasText: tableName });
    await expect(tableButton).toBeVisible();
    await tableButton.click();
    await expect(window.getByRole('heading', { name: tableName })).toBeVisible();
    await expect(window.getByText('Esta mesa ainda não possui vendas concluídas.')).toBeVisible();

    const catalogItem = window.getByRole('button', { name: new RegExp(productName, 'u') });
    await expect(catalogItem).toBeVisible();
    await catalogItem.click();
    await expect(window.getByText(productName, { exact: true }).last()).toBeVisible();

    const quantityInput = window.getByLabel(`Quantidade de ${productName}`);
    await quantityInput.fill('2');
    await quantityInput.press('Enter');
    await expect(window.getByText('R$ 20,00', { exact: true }).last()).toBeVisible();
    await window.getByRole('button', { name: `Diminuir ${productName}` }).click();
    await expect(quantityInput).toHaveValue('1');
    await expect(window.getByText('R$ 10,00', { exact: true }).last()).toBeVisible();

    await expect(window.getByText('Aplicado automaticamente')).toBeVisible();
    await expect(window.getByText('R$ 10,00', { exact: true }).last()).toBeVisible();
    await expect(window.getByLabel('Valor recebido 1')).toBeVisible();
    await window.getByLabel('Valor recebido 1').fill('20.00');
    await expect(window.getByText('Troco: R$ 10,00', { exact: true })).toBeVisible();
    await window.getByRole('button', { name: 'Concluir venda' }).click();
    await expect(window.getByText('Venda concluída e registrada no histórico da mesa.')).toBeVisible();
    await expect(window.getByRole('heading', { name: tableName })).toBeVisible();
    const tableHistory = window.locator('article.recent-order-card').filter({ hasText: productName });
    await expect(tableHistory).toContainText('Paga');

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
