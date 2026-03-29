// ============================================================================
// Access verification — POST /api/verify-access
// ============================================================================
// Checks the shared beta password. The password is stored server-side as
// BETA_ACCESS_CODE in Vercel environment variables — never sent to the client.
//
// If BETA_ACCESS_CODE is not set, access is open (dev mode).

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

  const { code } = req.body || {};
  const accessCode = process.env.BETA_ACCESS_CODE;

  // If no access code is configured, allow everyone (dev mode)
  if (!accessCode) {
    return res.status(200).json({ valid: true });
  }

  if (typeof code !== 'string' || code.trim() !== accessCode) {
    return res.status(401).json({ valid: false, error: 'Invalid access code' });
  }

  return res.status(200).json({ valid: true });
}
