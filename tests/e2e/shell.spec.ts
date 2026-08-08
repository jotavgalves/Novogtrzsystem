import path from 'node:path';

import { expect, test } from '@playwright/test';
import { _electron as electron } from 'playwright';

const applicationPath = path.join(process.cwd(), 'apps', 'desktop');

test('SMK-INF-002 — abre o GTRZ System com navegação modular', async () => {
  const electronApplication = await electron.launch({ args: [applicationPath] });

  try {
    const window = await electronApplication.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await expect(window).toHaveTitle('GTRZ System');
    await expect(window.locator('#root')).not.toBeEmpty();
    await expect(window.getByRole('img', { name: 'GTRZ' })).toBeVisible();

    const bodyText = await window.locator('body').innerText();
    expect(bodyText).not.toContain('Falha ao abrir esta área');

    await expect(window.getByRole('navigation', { name: 'Módulos do sistema' })).toBeVisible();
    await expect(window.getByRole('link', { name: 'Estoque' })).toBeVisible();
    await expect(window.getByRole('link', { name: 'Mesas e balcão' })).toBeVisible();
    await expect(window.getByText('Banco íntegro')).toBeVisible();
  } finally {
    await electronApplication.close();
  }
});

test('SMK-USR-001 — Caixa vê somente os módulos permitidos e retorna com senha', async () => {
  const electronApplication = await electron.launch({ args: [applicationPath] });

  try {
    const window = await electronApplication.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.getByRole('button', { name: 'Usar perfil Caixa' }).click();
    await expect(window.getByText('Caixa', { exact: true })).toBeVisible();
    await expect(window.getByRole('link', { name: 'Mesas e balcão' })).toBeVisible();
    await expect(window.getByRole('link', { name: 'Estoque' })).toBeVisible();
    await expect(window.getByRole('link', { name: 'Ingressos' })).toHaveCount(0);
    await expect(window.getByRole('link', { name: 'Configurações' })).toHaveCount(0);

    await window.getByPlaceholder('Digite a senha').fill('121225');
    await window.getByRole('button', { name: 'Entrar em Produção' }).click();

    await expect(window.getByText('Produção', { exact: true })).toBeVisible();
    await expect(window.getByRole('link', { name: 'Ingressos' })).toBeVisible();
    await expect(window.getByRole('link', { name: 'Configurações' })).toBeVisible();
  } finally {
    await electronApplication.close();
  }
});

test('SMK-BKP-001 — cria e verifica backup manual pela interface', async () => {
  const electronApplication = await electron.launch({ args: [applicationPath] });

  try {
    const window = await electronApplication.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.getByRole('link', { name: 'Backups' }).click();
    await expect(window.getByRole('heading', { name: 'Backups' })).toBeVisible();
    await window.getByRole('button', { name: 'Criar backup' }).click();
    await expect(window.getByText(/criado e verificado/u)).toBeVisible();

    const verifyButton = window.getByRole('button', { name: 'Verificar' }).first();
    await expect(verifyButton).toBeVisible();
    await verifyButton.click();
    await expect(window.getByText(/está íntegro/u)).toBeVisible();
  } finally {
    await electronApplication.close();
  }
});

test('SMK-EST-001 — baixa estoque, exclui cadastro virgem e protege custos no Caixa', async () => {
  const electronApplication = await electron.launch({ args: [applicationPath] });

  try {
    const window = await electronApplication.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    const suffix = String(Date.now());
    const eventName = `Evento estoque ${suffix}`;
    const categoryName = `Cervejas ${suffix}`;
    const productName = `Budweiser ${suffix}`;
    const wrongProductName = `Cadastro errado ${suffix}`;

    await window.getByRole('link', { name: 'Eventos' }).click();
    await window.getByPlaceholder('Ex.: La Rumba Neon — Agosto').fill(eventName);
    await window.getByRole('button', { name: 'Criar evento' }).click();
    const eventCard = window.locator('article.event-card').filter({ hasText: eventName });
    await expect(eventCard).toBeVisible();
    const operateButton = eventCard.getByRole('button', { name: 'Operar evento' });
    if (await operateButton.isVisible()) {
      await operateButton.click();
    }

    await window.getByRole('link', { name: 'Estoque' }).click();
    await expect(window.getByRole('heading', { name: /^Estoque$/u })).toBeVisible();

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
    await productForm.getByLabel('Aviso de estoque baixo', { exact: true }).fill('3');
    await productForm.getByRole('button', { name: 'Cadastrar produto' }).click();

    let productCard = window.locator('article.inventory-card').filter({ hasText: productName });
    await expect(productCard).toBeVisible();
    await expect(productCard.getByText('R$ 4,00')).toBeVisible();
    await expect(productCard.getByText('40.00%')).toBeVisible();

    await productCard.getByRole('button', { name: 'Entrada / ajuste' }).click();
    let movementForm = window.locator('form.movement-form');
    await movementForm.getByLabel('Quantidade', { exact: true }).fill('6');
    await movementForm.getByRole('button', { name: 'Registrar movimento' }).click();

    productCard = window.locator('article.inventory-card').filter({ hasText: productName });
    await expect(productCard.getByText('6 un.')).toBeVisible();
    await productCard.getByRole('button', { name: 'Baixar estoque' }).click();
    movementForm = window.locator('form.movement-form');
    await expect(movementForm.getByRole('combobox')).toHaveValue('loss');
    await movementForm.getByLabel('Quantidade', { exact: true }).fill('2');
    await movementForm.getByPlaceholder('Ex.: 2 unidades quebradas').fill('Perda operacional');
    await movementForm.getByRole('button', { name: 'Confirmar baixa' }).click();

    productCard = window.locator('article.inventory-card').filter({ hasText: productName });
    await expect(productCard.getByText('4 un.')).toBeVisible();

    await productForm.getByLabel('Nome', { exact: true }).fill(wrongProductName);
    await productForm.getByRole('combobox').first().selectOption({ label: categoryName });
    await productForm.getByLabel('Preço de custo', { exact: true }).fill('1.00');
    await productForm.getByLabel('Preço de venda', { exact: true }).fill('2.00');
    await productForm.getByLabel('Aviso de estoque baixo', { exact: true }).fill('0');
    await productForm.getByRole('button', { name: 'Cadastrar produto' }).click();

    const wrongProductCard = window
      .locator('article.inventory-card')
      .filter({ hasText: wrongProductName });
    await expect(wrongProductCard).toBeVisible();
    await wrongProductCard.getByRole('button', { name: 'Excluir', exact: true }).click();
    await expect(wrongProductCard.getByText('Exclusão definitiva disponível')).toBeVisible();
    await wrongProductCard.getByPlaceholder('Ex.: item cadastrado por engano').fill('Cadastro duplicado');
    await wrongProductCard.getByRole('button', { name: 'Excluir definitivamente' }).click();
    await expect(
      window.locator('article.inventory-card').filter({ hasText: wrongProductName }),
    ).toHaveCount(0);

    await window.getByRole('button', { name: 'Usar perfil Caixa' }).click();
    await expect(window.getByText('Caixa', { exact: true })).toBeVisible();
    await window.getByRole('link', { name: 'Estoque' }).click();
    await expect(window.getByRole('heading', { name: /^Estoque$/u })).toBeVisible();

    productCard = window.locator('article.inventory-card').filter({ hasText: productName });
    await expect(productCard).toBeVisible();
    await expect(productCard.getByText('R$ 10,00')).toBeVisible();
    await expect(productCard.getByText('Lucro bruto')).toHaveCount(0);
    await expect(productCard.getByText('Custo')).toHaveCount(0);
    await expect(productCard.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    await expect(productCard.getByRole('button', { name: 'Entrada / ajuste' })).toHaveCount(0);
    await expect(productCard.getByRole('button', { name: 'Baixar estoque' })).toHaveCount(0);
  } finally {
    await electronApplication.close();
  }
});
