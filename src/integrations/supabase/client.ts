import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { getSupabaseConfig, getSupabaseConfigInfo } from '@/lib/supabaseConfig';

// Get Supabase configuration (supports dual: Lovable + Local)
const config = getSupabaseConfig();

// Log configuration info in development
if (import.meta.env.DEV) {
  const configInfo = getSupabaseConfigInfo();
  console.log('🔧 Supabase Configuration:', {
    provider: configInfo.provider,
    hasLocalConfig: configInfo.hasLocalConfig,
    useLocal: configInfo.useLocal,
    url: config.url.substring(0, 30) + '...'
  });
}

// Create Supabase client with the selected configuration
export const supabase = createClient<Database>(config.url, config.anonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Export configuration info for debugging
export const supabaseConfig = {
  provider: config.provider,
  url: config.url,
  info: getSupabaseConfigInfo()
};