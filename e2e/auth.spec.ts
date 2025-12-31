import { test, expect } from '@playwright/test';

const e2eEmail = process.env.E2E_EMAIL;
const e2ePassword = process.env.E2E_PASSWORD;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('language', 'pt');
  });
});

test('auth page renders login form', async ({ page }) => {
  await page.goto('/auth');
  await expect(page.locator('#login-email')).toBeVisible();
  await expect(page.locator('#login-password')).toBeVisible();
});

test('sign in with existing user', async ({ page }) => {
  test.skip(!e2eEmail || !e2ePassword, 'E2E_EMAIL/E2E_PASSWORD not set');

  await page.goto('/auth');
  await page.fill('#login-email', e2eEmail ?? '');
  await page.fill('#login-password', e2ePassword ?? '');
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
});
