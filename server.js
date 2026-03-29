// ============================================================================
// Local dev server for api/chat.js
// ============================================================================
// Wraps the Vercel serverless function for local development.
// Run: node server.js
// Then: npm run dev (Vite proxies /api to this server)
//
// PRE-AUTH SCAFFOLD — no user verification. Internal use only.

import { readFileSync } from 'node:fs';
import http from 'node:http';

// Load .env.local BEFORE importing handlers (they read process.env at module init)
try {
  const envFile = readFileSync('.env.local', 'utf8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {
  console.warn('No .env.local found — using existing environment variables');
}

// Dynamic imports so env vars are available when modules initialize
const { default: chatHandler } = await import('./v2_definitive/api/chat.js');
const { default: parseHandler } = await import('./api/parse-2567.js');
const { default: verifyHandler } = await import('./api/verify-access.js');
const { default: feedbackHandler } = await import('./api/feedback.js');
const { default: conversationsHandler } = await import('./api/conversations.js');
const { default: ingestCensusHandler } = await import('./api/ingest-census.js');
const { default: ingestKnowledgeHandler } = await import('./api/ingest-knowledge.js');

const PORT = 3001;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Minimal Express-like res adapter for Vercel-style handlers
  const resAdapter = {
    statusCode: 200,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.headers['Content-Type'] = 'application/json';
      res.writeHead(this.statusCode, this.headers);
      res.end(JSON.stringify(data));
    },
    end() {
      res.writeHead(this.statusCode, this.headers);
      res.end();
    },
  };

  try {
    // Route: /api/verify-access — password gate
    if (url.pathname === '/api/verify-access' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) { body += chunk; }
      try { req.body = JSON.parse(body); } catch { req.body = {}; }
      await verifyHandler(req, resAdapter);
      return;
    }

    // Route: /api/feedback — feedback collection
    if (url.pathname === '/api/feedback' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) { body += chunk; }
      try { req.body = JSON.parse(body); } catch { req.body = {}; }
      await feedbackHandler(req, resAdapter);
      return;
    }

    // Route: /api/conversations — list/load conversations
    if (url.pathname === '/api/conversations' && req.method === 'GET') {
      req.url = url.pathname + url.search; // preserve query string
      await conversationsHandler(req, resAdapter);
      return;
    }

    // Route: /api/ingest-knowledge — knowledge source ingestion
    if (url.pathname === '/api/ingest-knowledge') {
      if (req.method === 'GET') {
        req.url = url.pathname + url.search;
        await ingestKnowledgeHandler(req, resAdapter);
        return;
      }
      if (req.method === 'POST') {
        let body = '';
        for await (const chunk of req) { body += chunk; }
        try { req.body = JSON.parse(body); } catch { req.body = {}; }
        await ingestKnowledgeHandler(req, resAdapter);
        return;
      }
    }

    // Route: /api/ingest-census — CSV census upload
    if (url.pathname === '/api/ingest-census' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) { body += chunk; }
      req.body = body;
      await ingestCensusHandler(req, resAdapter);
      return;
    }

    // Route: /api/parse-2567 — PDF upload (multipart or raw)
    if (url.pathname === '/api/parse-2567' && req.method === 'POST') {
      await parseHandler(req, resAdapter);
      return;
    }

    // Route: /api/chat — chat handler (JSON body)
    if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }
      try {
        req.body = JSON.parse(body);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
    }

    await chatHandler(req, resAdapter);
  } catch (err) {
    console.error('Handler error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`IHCM Bot API server running on http://localhost:${PORT}`);
  console.log('PRE-AUTH SCAFFOLD — no user verification');
  console.log('');
  console.log('Supabase:', process.env.SUPABASE_URL ? 'connected' : 'not configured (using static fallbacks)');
  console.log('Anthropic:', process.env.ANTHROPIC_API_KEY ? 'configured' : 'NOT SET — API calls will fail');
});
