import { test, expect } from '@playwright/test';
import {
  mockAdminUser,
  mockSupabaseRoutes,
  seedSupabaseSession
} from './utils/supabase-mock';

test.beforeEach(async ({ page }) => {
  await seedSupabaseSession(page, mockAdminUser);
  await mockSupabaseRoutes(page, { user: mockAdminUser });
});

test('admin can load the admin panel', async ({ page }) => {
  await page.goto('/admin');

  await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'CSV Import' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Flag Queue' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Scrape Failures' })).toBeVisible();

  await page.getByRole('tab', { name: 'Database' }).click();
  await expect(page.getByRole('heading', { name: 'Database Management' })).toBeVisible();

  await page.getByRole('tab', { name: 'Flag Queue' }).click();
  await expect(page.getByRole('heading', { name: 'Flag Queue' })).toBeVisible();

  await page.getByRole('tab', { name: 'Scrape Failures' }).click();
  await expect(page.getByRole('heading', { name: 'Scrape Failures Review' })).toBeVisible();
});
