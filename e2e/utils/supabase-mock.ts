import type { Page, Route } from '@playwright/test';

type MockUser = {
  id: string;
  email: string;
};

type PanelRecord = { id: string } & Record<string, unknown>;

type SupabaseMockOptions = {
  user?: MockUser | null;
  panels?: PanelRecord[];
  favorites?: Record<string, unknown>[];
  hidden?: Record<string, unknown>[];
};

const nowSeconds = () => Math.floor(Date.now() / 1000);

const defaultPanelA = {
  id: 'panel-alpha',
  name: 'Alpha 100W',
  manufacturer: 'SunCo',
  wattage: 100,
  voltage: 12,
  length_cm: 100,
  width_cm: 50,
  weight_kg: 7.2,
  price_usd: 99.99,
  description: 'Compact 100W panel',
  image_url: null,
  web_url: 'https://example.com/alpha',
  asin: 'B000TEST01',
  piece_count: 1,
  missing_fields: null,
  user_verified_overrides: null,
  manual_overrides: null,
  flag_count: 0,
  pending_flags: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

const defaultPanelB = {
  id: 'panel-beta',
  name: 'Beta 200W',
  manufacturer: 'RayWorks',
  wattage: 200,
  voltage: 24,
  length_cm: 130,
  width_cm: 55,
  weight_kg: 12.4,
  price_usd: 189.5,
  description: 'Higher output 200W panel',
  image_url: null,
  web_url: 'https://example.com/beta',
  asin: 'B000TEST02',
  piece_count: 1,
  missing_fields: null,
  user_verified_overrides: null,
  manual_overrides: null,
  flag_count: 0,
  pending_flags: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

export const mockPanels = [defaultPanelA, defaultPanelB];

export const mockUser: MockUser = {
  id: 'user-123',
  email: 'user@example.com'
};

export const mockAdminUser: MockUser = {
  id: 'admin-123',
  email: 'admin@example.com'
};

const buildSession = (user: MockUser) => {
  const expiresAt = nowSeconds() + 3600;
  return {
    access_token: 'e2e-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    refresh_token: 'e2e-refresh-token',
    user: {
      id: user.id,
      email: user.email,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: '2024-01-01T00:00:00Z'
    }
  };
};

export const seedSupabaseSession = async (page: Page, user: MockUser, host = 'localhost') => {
  const storageKey = `sb-${host.split('.')[0]}-auth-token`;
  const session = buildSession(user);

  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: storageKey, value: session }
  );
};

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'apikey, authorization, content-type, prefer, accept-profile, x-client-info',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS'
};

const fulfillJson = (route: Route, data: unknown, status = 200) => {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: corsHeaders,
    body: JSON.stringify(data)
  });
};

const resolvePanels = (url: URL, panels: PanelRecord[]) => {
  const idParam = url.searchParams.get('id');
  if (idParam && idParam.startsWith('eq.')) {
    const id = decodeURIComponent(idParam.slice(3));
    return panels.filter(panel => panel.id === id);
  }
  return panels;
};

export const mockSupabaseRoutes = async (page: Page, options: SupabaseMockOptions = {}) => {
  const user = options.user ?? null;
  const panels = options.panels ?? mockPanels;
  const favorites =
    options.favorites ??
    (user
      ? [{ panel_id: defaultPanelA.id, solar_panels: defaultPanelA }]
      : []);
  const hidden =
    options.hidden ??
    (user
      ? [{ panel_id: defaultPanelB.id, solar_panels: defaultPanelB }]
      : []);

  await page.route(/\/auth\/v1\//, async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url());
    if (url.pathname.endsWith('/user')) {
      return fulfillJson(route, { user });
    }

    if (url.pathname.endsWith('/token')) {
      if (!user) {
        return fulfillJson(route, { error: 'invalid_credentials' }, 400);
      }
      return fulfillJson(route, buildSession(user));
    }

    if (url.pathname.endsWith('/logout')) {
      return fulfillJson(route, {});
    }

    return fulfillJson(route, {});
  });

  await page.route(/\/rest\/v1\//, async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url());
    const path = url.pathname;

    if (path.includes('/rest/v1/solar_panels')) {
      const result = resolvePanels(url, panels);
      return fulfillJson(route, result);
    }

    if (path.includes('/rest/v1/user_panel_preferences')) {
      return fulfillJson(route, hidden);
    }

    if (path.includes('/rest/v1/user_favorites')) {
      return fulfillJson(route, favorites);
    }

    if (path.includes('/rest/v1/rpc/admin_get_flag_queue')) {
      return fulfillJson(route, []);
    }

    if (path.includes('/rest/v1/raw_scraper_data')) {
      return fulfillJson(route, []);
    }

    if (path.includes('/rest/v1/user_flags')) {
      return fulfillJson(route, []);
    }

    if (path.includes('/rest/v1/filtered_asins')) {
      return fulfillJson(route, []);
    }

    return fulfillJson(route, []);
  });
};
