import { test, expect } from '@playwright/test';
import {
  mockPanels,
  mockSupabaseRoutes,
  mockUser,
  seedSupabaseSession
} from './utils/supabase-mock';

test.beforeEach(async ({ page }) => {
  await seedSupabaseSession(page, mockUser);
  await mockSupabaseRoutes(page, { user: mockUser, hidden: [] });
});

test('signed-in user can filter to favorites', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText(mockPanels[0].name as string)).toBeVisible();
  await expect(page.getByText(mockPanels[1].name as string)).toBeVisible();

  const favoritesToggle = page.getByRole('checkbox', { name: /show favorites only/i });
  await expect(favoritesToggle).toBeVisible();
  await favoritesToggle.check();

  await expect(page.getByText(mockPanels[0].name as string)).toBeVisible();
  await expect(page.getByText(mockPanels[1].name as string)).toHaveCount(0);
});
