/**
 * Supabase Configuration Management
 * Supports dual configuration: Lovable (default) and Local Development
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  provider: 'lovable' | 'local';
}

export interface SupabaseConfigOptions {
  useLocal?: boolean;
  lovableUrl?: string;
  lovableKey?: string;
  localUrl?: string;
  localKey?: string;
}

/**
 * Get Supabase configuration based on environment variables and options
 */
export const getSupabaseConfig = (options: SupabaseConfigOptions = {}): SupabaseConfig => {
  // Check if we should use local Supabase
  const useLocal = options.useLocal ?? 
    import.meta.env.VITE_USE_LOCAL_SUPABASE === 'true';

  if (useLocal) {
    const localUrl = options.localUrl ?? import.meta.env.VITE_LOCAL_SUPABASE_URL;
    const localKey = options.localKey ?? import.meta.env.VITE_LOCAL_SUPABASE_PUBLISHABLE_KEY;

    if (!localUrl || !localKey) {
      console.warn('Local Supabase configuration incomplete. Falling back to Lovable.');
      return getLovableConfig(options);
    }

    return {
      url: localUrl,
      anonKey: localKey,
      provider: 'local'
    };
  }

  return getLovableConfig(options);
};

/**
 * Get Lovable Supabase configuration
 */
export const getLovableConfig = (options: SupabaseConfigOptions = {}): SupabaseConfig => {
  const url = options.lovableUrl ?? import.meta.env.VITE_SUPABASE_URL;
  const anonKey = options.lovableKey ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    throw new Error('Lovable Supabase configuration is missing. Please check your environment variables.');
  }

  return {
    url,
    anonKey,
    provider: 'lovable'
  };
};

/**
 * Get current Supabase configuration info for debugging
 */
export const getSupabaseConfigInfo = () => {
  const config = getSupabaseConfig();
  return {
    provider: config.provider,
    url: config.url,
    hasLocalConfig: !!(import.meta.env.VITE_LOCAL_SUPABASE_URL && import.meta.env.VITE_LOCAL_SUPABASE_PUBLISHABLE_KEY),
    useLocal: import.meta.env.VITE_USE_LOCAL_SUPABASE === 'true'
  };
};
