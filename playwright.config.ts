import { defineConfig, devices } from '@playwright/test';

delete process.env.FORCE_COLOR;
delete process.env.NO_COLOR;

const baseURL = 'http://localhost:4173';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'] , ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      BROWSERSLIST_IGNORE_OLD_DATA: '1',
      VITE_USE_LOCAL_SUPABASE: 'true',
      VITE_LOCAL_SUPABASE_URL: 'http://localhost:54321',
      VITE_LOCAL_SUPABASE_PUBLISHABLE_KEY: 'e2e-local-key',
      VITE_ADMIN_EMAIL: 'admin@example.com',
      VITE_E2E: 'true'
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
