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
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const { createClient } = await import('@supabase/supabase-js');

    // Service-role client for admin writes (bypasses RLS)
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

    // RLS-enforced client using anon key + user JWT
    // Database RLS policies (role, domain, facility checks) are enforced on this client
    let supabaseUser = supabase; // fallback to service if no anon key
    if (anonKey) {
      supabaseUser = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
    }

    return {
      user,           // { id, email, ... }
      profile,        // { app_role, global_access_level, full_name, allowed_bot_roles }
      supabase,       // service-role client (bypasses RLS) — use for admin writes
      supabaseUser,   // RLS-enforced client — use for user-scoped reads
    };
  } catch (err) {
    console.warn('[requireAuth] JWT verification failed:', err.message);
    return null;
  }
}
