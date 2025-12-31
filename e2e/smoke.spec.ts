import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('language', 'pt');
  });
});

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Excel VBA Blocker').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Planos' })).toBeVisible();
});
