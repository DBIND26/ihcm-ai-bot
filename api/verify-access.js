// ============================================================================
// Access verification — POST /api/verify-access
// ============================================================================
// Checks the shared beta password. The password is stored server-side as
// BETA_ACCESS_CODE in Vercel environment variables — never sent to the client.
//
// If BETA_ACCESS_CODE is not set, access is rejected (no open access).
// On success, creates/resolves a beta_users row and returns the betaUserId.

import { createHmac } from 'node:crypto';
import { getOrCreateBetaUser } from './lib/betaUser.js';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function createSessionToken(name, secret) {
  const normalizedName = String(name || '').trim().toLowerCase();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${normalizedName}:${expiresAt}`;
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  return `${expiresAt}.${signature}`;
}

export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || '';
  if (origin.endsWith('.vercel.app') || origin.startsWith('http://localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code, name } = req.body || {};
  const accessCode = process.env.BETA_ACCESS_CODE;

  // If no access code is configured, require it anyway (no open access)
  if (!accessCode) {
    console.warn('[verify-access] BETA_ACCESS_CODE not set — rejecting all access');
    return res.status(401).json({ valid: false, error: 'Access not configured. Set BETA_ACCESS_CODE in environment.' });
  }

  if (typeof code !== 'string' || code.trim() !== accessCode) {
    console.log(JSON.stringify({
      event: 'access_denied',
      name: name || null,
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      timestamp: new Date().toISOString(),
    }));
    return res.status(401).json({ valid: false, error: 'Invalid access code' });
  }

  console.log(JSON.stringify({
    event: 'access_granted',
    name: name || null,
    ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
    timestamp: new Date().toISOString(),
  }));

  // Create/resolve beta user if Supabase is configured
  let betaUserId = null;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY && name) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
      betaUserId = await getOrCreateBetaUser(supabase, name);
    } catch (err) {
      console.warn('[verify-access] Beta user creation failed:', err.message);
    }
  }

  const sessionToken = createSessionToken(name, accessCode);
  return res.status(200).json({ valid: true, betaUserId, sessionToken });
}
