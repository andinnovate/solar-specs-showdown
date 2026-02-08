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

test('imperial units show correct watts per area and weight', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('solar-panel-unit-system', 'imperial');
  });

  await page.goto('/');

  const panelHeading = page.getByRole('heading', { name: 'Alpha 100W' });
  const panelCard = panelHeading.locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');

  await expect(panelCard.getByText('W/lb:')).toBeVisible();
  await expect(panelCard.getByText('6.3')).toBeVisible();
  await expect(panelCard.getByText('W/ft²:')).toBeVisible();
  await expect(panelCard.getByText('18.6')).toBeVisible();
});
