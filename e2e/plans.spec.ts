import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('language', 'pt');
  });
});

test('plans page renders plan cards', async ({ page }) => {
  await page.goto('/plans');
  await expect(page.getByRole('heading', { name: 'Escolha seu Plano' })).toBeVisible();
  await expect(page.getByText('Gratuito').first()).toBeVisible();
  await expect(page.getByText('Profissional').first()).toBeVisible();
  await expect(page.getByText('Premium').first()).toBeVisible();
  await expect(page.getByText('Anual').first()).toBeVisible();
});
