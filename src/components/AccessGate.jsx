import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

export default function AccessGate({ onAuthenticated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (profile) {
          onAuthenticated(buildSession(session, profile));
          return;
        }
      }
      setChecking(false);
    });

    // Listen for auth state changes (token refresh, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        // handled by App.jsx
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('app_role, global_access_level, full_name, allowed_bot_roles, is_active')
      .eq('user_id', userId)
      .single();

    if (error || !data?.is_active) return null;
    return data;
  }

  function buildSession(session, profile) {
    return {
      userId: session.user.id,
      email: session.user.email,
      userName: profile.full_name || session.user.email,
      appRole: profile.app_role,
      globalAccess: profile.global_access_level,
      allowedRoles: profile.allowed_bot_roles || [],
      allowedBuildings: null, // null = all (will use global_access_level + user_facility_access later)
      accessToken: session.access_token,
    };
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) { setError('Please enter your email'); return; }
    if (!password.trim()) { setError('Please enter your password'); return; }

    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (authError) {
        setError(authError.message === 'Invalid login credentials'
          ? 'Invalid email or password'
          : authError.message);
        setLoading(false);
        return;
      }

      if (!data.session) {
        setError('Login failed — no session returned');
        setLoading(false);
        return;
      }

      const profile = await fetchProfile(data.user.id);
      if (!profile) {
        setError('Account exists but profile not configured. Contact your administrator.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      onAuthenticated(buildSession(data.session, profile));
    } catch (err) {
      setError('Connection error — try again');
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <p style={{ color: '#6b7280' }}>Loading...</p>
      </div>
    );
  }

  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: '8px',
    border: '1px solid #d1d5db', fontSize: '15px', fontFamily: 'inherit',
    boxSizing: 'border-box', marginBottom: '12px',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#f9fafb'
    }}>
      <form onSubmit={handleSubmit} style={{
        backgroundColor: 'white', padding: '36px', borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.1)', width: '400px', textAlign: 'center'
      }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: '600', color: '#1f2937' }}>
          IHCM AI Bot
        </h1>
        <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#6b7280' }}>
          Sign in with your IHCM account
        </p>

        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Email address" autoFocus autoComplete="email" style={inputStyle} />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Password" autoComplete="current-password" style={inputStyle} />

        {error && <p style={{ color: '#dc2626', fontSize: '13px', margin: '0 0 12px 0' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{
          width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
          backgroundColor: loading ? '#93c5fd' : '#2563eb', color: 'white', fontSize: '15px',
          fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer'
        }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
