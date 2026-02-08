import { test, expect } from '@playwright/test';
import { mockSupabaseRoutes } from './utils/supabase-mock';

test.beforeEach(async ({ page }) => {
  await mockSupabaseRoutes(page, { user: null });
});

test('anon sees sign-in prompt on preferences', async ({ page }) => {
  await page.goto('/preferences');

  await expect(page.getByRole('heading', { name: 'Your Preferences' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign In Required' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
});
