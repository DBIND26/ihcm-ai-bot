// ============================================================================
// Beta user identity helper
// ============================================================================
// Resolves a userName string to a stable UUID in the beta_users table.
// Used by chat.js, feedback.js, and verify-access.js during the pre-auth phase.
//
// When migrating to Supabase Auth, replace calls to getOrCreateBetaUser()
// with auth.uid() from the authenticated session.

/**
 * Look up or create a beta user by name. Returns their UUID, or null on failure.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userName
 * @param {string} [roleHint] - optional role hint (e.g. 'don', 'regional')
 * @returns {Promise<string|null>} user_id UUID
 */
export async function getOrCreateBetaUser(supabase, userName, roleHint) {
  if (!supabase || !userName) return null;

  const name = userName.trim().toLowerCase();
  if (!name) return null;

  try {
    // Try to find existing user
    const { data: existing } = await supabase
      .from('beta_users')
      .select('user_id')
      .eq('user_name', name)
      .single();

    if (existing?.user_id) return existing.user_id;

    // Create new beta user
    const { data: created, error } = await supabase
      .from('beta_users')
      .insert({ user_name: name, role_hint: roleHint || null })
      .select('user_id')
      .single();

    if (error) {
      // Handle race condition: another request may have inserted first
      if (error.code === '23505') { // unique_violation
        const { data: retry } = await supabase
          .from('beta_users')
          .select('user_id')
          .eq('user_name', name)
          .single();
        return retry?.user_id || null;
      }
      console.warn('[betaUser] Insert failed:', error.message);
      return null;
    }

    return created?.user_id || null;
  } catch (err) {
    console.warn('[betaUser] Error:', err.message);
    return null;
  }
}
