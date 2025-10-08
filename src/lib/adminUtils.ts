/**
 * Admin utilities for user type differentiation
 */

export const ADMIN_EMAIL = '***REMOVED***';

/**
 * Check if a user is an admin user
 * @param user - The authenticated user object
 * @returns boolean indicating if user is admin
 */
export const isAdminUser = (user: { email?: string } | null): boolean => {
  return user?.email === ADMIN_EMAIL;
};

/**
 * Check if current authenticated user is admin
 * @returns Promise<boolean> indicating if current user is admin
 */
export const isCurrentUserAdmin = async (): Promise<boolean> => {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data: { user } } = await supabase.auth.getUser();
  return isAdminUser(user);
};
