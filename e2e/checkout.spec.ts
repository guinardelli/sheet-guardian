import { test, expect } from '@playwright/test';

const e2eEmail = process.env.E2E_EMAIL;
const e2ePassword = process.env.E2E_PASSWORD;
const runCheckout = process.env.E2E_CHECKOUT === 'true';

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

test('start checkout flow', async ({ page }) => {
  test.skip(!runCheckout || !e2eEmail || !e2ePassword, 'E2E checkout disabled');

  await signIn(page);
  await page.goto('/plans');

  const upgradeButton = page.getByRole('button', { name: 'Fazer Upgrade' }).first();
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    upgradeButton.click(),
  ]);

  await expect(popup).toHaveURL(/stripe\.com/);
});
