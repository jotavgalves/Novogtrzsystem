import path from 'node:path';

import { expect, test } from '@playwright/test';
import { _electron as electron } from 'playwright';

const applicationPath = path.join(process.cwd(), 'apps', 'desktop');

test('SMK-CMB-001 — calcula combo pelo estoque dos componentes e protege custos no Caixa', async () => {
  const electronApplication = await electron.launch({ args: [applicationPath] });

  try {
    const window = await electronApplication.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    const suffix = String(Date.now());
    const eventName = `Evento combo ${suffix}`;
    const categoryName = `Cervejas combo ${suffix}`;
    const productName = `Bud combo ${suffix}`;
    const comboName = `Dupla Bud ${suffix}`;

    await window.getByRole('link', { name: 'Eventos' }).click();
    await window.getByPlaceholder('Ex.: La Rumba Neon — Agosto').fill(eventName);
    await window.getByRole('button', { name: 'Criar evento' }).click();
    await expect(window.getByText(eventName, { exact: true }).first()).toBeVisible();

    await window.getByRole('link', { name: 'Estoque' }).click();
    await window.getByPlaceholder('Ex.: Cervejas').fill(categoryName);
    await window.getByRole('button', { name: 'Criar categoria' }).click();
    await expect(
      window.locator('.category-chips').getByText(categoryName, { exact: true }),
    ).toBeVisible();

    const productForm = window.locator('form.product-form');
    await productForm.getByLabel('Nome', { exact: true }).fill(productName);
    await productForm.getByRole('combobox').first().selectOption({ label: categoryName });
    await productForm.getByLabel('Preço de custo', { exact: true }).fill('6.00');
    await productForm.getByLabel('Preço de venda', { exact: true }).fill('10.00');
    await productForm.getByLabel('Aviso de estoque baixo', { exact: true }).fill('2');
    await productForm.getByRole('button', { name: 'Cadastrar produto' }).click();

    let productCard = window.locator('article.inventory-card').filter({ hasText: productName });
    await productCard.getByRole('button', { name: 'Movimentar' }).click();
    const movementForm = window.locator('form.movement-form');
    await movementForm.getByLabel('Quantidade', { exact: true }).fill('6');
    await movementForm.getByRole('button', { name: 'Registrar movimento' }).click();
    productCard = window.locator('article.inventory-card').filter({ hasText: productName });
    await expect(productCard.getByText('6 un.', { exact: true })).toBeVisible();

    const comboForm = window.locator('form.combo-form');
    await comboForm.getByLabel('Nome do combo', { exact: true }).fill(comboName);
    await comboForm.getByLabel('Preço do combo', { exact: true }).fill('18.00');
    await comboForm
      .getByLabel('Produto do combo', { exact: true })
      .selectOption({ label: productName });
    await comboForm.getByLabel('Quantidade do componente', { exact: true }).fill('2');
    await comboForm.getByRole('button', { name: 'Adicionar componente' }).click();
    await comboForm.getByRole('button', { name: 'Cadastrar combo' }).click();

    let comboCard = window.locator('article.combo-card').filter({ hasText: comboName });
    await expect(comboCard).toBeVisible();
    await expect(comboCard.getByText('3 disponíveis', { exact: true })).toBeVisible();
    await expect(comboCard.getByText('R$ 18,00', { exact: true })).toBeVisible();
    await expect(comboCard.getByText('R$ 20,00', { exact: true })).toBeVisible();
    await expect(comboCard.getByText('R$ 2,00', { exact: true })).toBeVisible();
    await expect(comboCard.getByText('R$ 12,00', { exact: true })).toBeVisible();
    await expect(comboCard.getByText('R$ 6,00', { exact: true })).toBeVisible();
    await expect(comboCard.getByText('33.33%', { exact: true })).toBeVisible();

    await window.getByRole('button', { name: 'Usar perfil Caixa' }).click();
    await expect(window.getByText('Caixa', { exact: true })).toBeVisible();
    await window.getByRole('link', { name: 'Estoque' }).click();

    comboCard = window.locator('article.combo-card').filter({ hasText: comboName });
    await expect(comboCard).toBeVisible();
    await expect(comboCard.getByText('3 disponíveis', { exact: true })).toBeVisible();
    await expect(comboCard.getByText('R$ 18,00', { exact: true })).toBeVisible();
    await expect(comboCard.getByText('R$ 2,00', { exact: true })).toBeVisible();
    await expect(comboCard.getByText('Custo consolidado')).toHaveCount(0);
    await expect(comboCard.getByText('Lucro bruto')).toHaveCount(0);
    await expect(comboCard.getByText('Margem')).toHaveCount(0);
    await expect(comboCard.getByRole('button', { name: 'Editar combo' })).toHaveCount(0);

    await window.getByPlaceholder('Digite a senha').fill('121225');
    await window.getByRole('button', { name: 'Entrar em Produção' }).click();
    await expect(window.getByText('Produção', { exact: true })).toBeVisible();
  } finally {
    await electronApplication.close();
  }
});
