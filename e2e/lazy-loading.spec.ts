import { test, expect } from '@playwright/test';
import { mockPanels, mockSupabaseRoutes } from './utils/supabase-mock';

const buildPanels = (count: number) => {
  const basePanel = mockPanels[0];
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return {
      ...basePanel,
      id: `lazy-panel-${number}`,
      name: `Lazy Panel ${number}`,
      manufacturer: 'Lazy Co',
      asin: `B0LAZY${String(number).padStart(4, '0')}`,
      wattage: 100 + number,
      voltage: 12,
      length_cm: 100,
      width_cm: 50,
      weight_kg: 7.2,
      price_usd: 99.99,
      piece_count: 1,
    };
  });
};

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 700 });
  await mockSupabaseRoutes(page, { user: null, panels: buildPanels(60) });
});

test('lazy loads more cards as you scroll', async ({ page }) => {
  await page.goto('/');

  const cardHeadings = page.getByRole('heading', { name: /Lazy Panel/ });
  await expect(cardHeadings.first()).toBeVisible();

  const initialCount = await cardHeadings.count();
  expect(initialCount).toBeGreaterThan(0);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  await expect.poll(async () => cardHeadings.count()).toBeGreaterThan(initialCount);
  await expect(page.getByRole('heading', { name: 'Lazy Panel 1', exact: true })).toBeAttached();
});
