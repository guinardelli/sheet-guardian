import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';

const e2eEmail = process.env.E2E_EMAIL;
const e2ePassword = process.env.E2E_PASSWORD;
const uploadFile = process.env.E2E_UPLOAD_FILE ?? 'teste_qa_desbloqueado.xlsm';

const signIn = async (page: import('@playwright/test').Page) => {
  await page.goto('/auth');
  await page.fill('#login-email', e2eEmail ?? '');
  await page.fill('#login-password', e2ePassword ?? '');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('language', 'pt');
  });
});

test('select file on dashboard', async ({ page }) => {
  test.skip(!e2eEmail || !e2ePassword, 'E2E_EMAIL/E2E_PASSWORD not set');

  await signIn(page);

  const filePath = path.resolve(process.cwd(), uploadFile);
  await expect(page.getByRole('heading', { name: 'Informações de Uso' })).toBeVisible();

  await page.setInputFiles('input[type="file"]', {
    name: path.basename(uploadFile),
    mimeType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
    buffer: fs.readFileSync(filePath),
  });

  await expect(page.getByRole('button', { name: 'Iniciar Processamento' })).toBeEnabled();
  await expect(page.getByText(path.basename(uploadFile))).toBeVisible();
});
