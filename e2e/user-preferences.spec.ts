import { test, expect } from '@playwright/test';
import {
  mockPanels,
  mockSupabaseRoutes,
  mockUser,
  seedSupabaseSession
} from './utils/supabase-mock';

test.beforeEach(async ({ page }) => {
  await seedSupabaseSession(page, mockUser);
  await mockSupabaseRoutes(page, { user: mockUser });
});

test('signed-in user sees preferences and favorites', async ({ page }) => {
  await page.goto('/preferences');

  await expect(page.getByRole('heading', { name: 'Your Preferences' })).toBeVisible();
  await expect(page.getByText('Your Panel Preferences')).toBeVisible();
  await expect(page.getByRole('tab', { name: /Favorites \(1\)/ })).toBeVisible();
  await expect(page.getByText(mockPanels[0].name as string)).toBeVisible();

  await page.getByRole('tab', { name: /Hidden \(1\)/ }).click();
  await expect(page.getByRole('heading', { name: 'Hidden Panels' })).toBeVisible();
  await expect(page.getByText(mockPanels[1].name as string)).toBeVisible();
});
