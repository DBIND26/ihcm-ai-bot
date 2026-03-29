// ============================================================================
// Server-side JWT verification for Supabase Auth
// ============================================================================
// Extracts the Bearer token from the Authorization header, verifies it
// via supabase.auth.getUser(), and returns the authenticated user.
//
// Also fetches the user's profile (app_role, allowed_bot_roles) from
// user_profiles for authorization checks.
//
// Usage in API handlers:
//   const { user, profile } = await requireAuth(req) || {};
//   if (!user) return res.status(401).json({ error: 'Unauthorized' });

export async function requireAuth(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the JWT and get the user
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    // Fetch user profile for role/permissions
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('app_role, global_access_level, full_name, allowed_bot_roles, is_active')
      .eq('user_id', user.id)
      .single();

    if (!profile?.is_active) return null;

    return {
      user,       // { id, email, ... }
      profile,    // { app_role, global_access_level, full_name, allowed_bot_roles }
      supabase,   // authenticated service client for downstream queries
    };
  } catch (err) {
    console.warn('[requireAuth] JWT verification failed:', err.message);
    return null;
  }
}
