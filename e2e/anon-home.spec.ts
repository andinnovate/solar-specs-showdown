import { test, expect } from '@playwright/test';
import { mockPanels, mockSupabaseRoutes } from './utils/supabase-mock';

test.beforeEach(async ({ page }) => {
  await mockSupabaseRoutes(page, { user: null });
});

test('anon can browse and compare panels', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Solar Panel Comparison' })).toBeVisible();
  await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  await expect(page.getByText(mockPanels[0].name as string)).toBeVisible();

  await page.getByRole('button', { name: /compare all/i }).click();
  await expect(page.getByRole('heading', { name: 'Comparison', exact: true })).toBeVisible();
});
