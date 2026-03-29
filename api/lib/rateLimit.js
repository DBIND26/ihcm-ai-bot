// ============================================================================
// Serverless rate limiting via Upstash Redis
// ============================================================================
// Shared across all Vercel function instances. Survives cold starts.
// Falls back to permissive (no limit) if Upstash is not configured.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let chatLimiter = null;
let feedbackLimiter = null;

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/**
 * Rate limiter for chat requests: 15 per minute per user
 */
export function getChatLimiter() {
  if (chatLimiter) return chatLimiter;
  const redis = getRedis();
  if (!redis) return null;
  chatLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(15, '60 s'),
    prefix: 'ihcm:chat',
  });
  return chatLimiter;
}

/**
 * Rate limiter for feedback: 10 per minute per user
 */
export function getFeedbackLimiter() {
  if (feedbackLimiter) return feedbackLimiter;
  const redis = getRedis();
  if (!redis) return null;
  feedbackLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '60 s'),
    prefix: 'ihcm:feedback',
  });
  return feedbackLimiter;
}

/**
 * Rate limiter for hospitalization reviews: 5 per minute per user
 */
let hospLimiter = null;
export function getHospLimiter() {
  if (hospLimiter) return hospLimiter;
  const redis = getRedis();
  if (!redis) return null;
  hospLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '60 s'),
    prefix: 'ihcm:hosp',
  });
  return hospLimiter;
}

/**
 * Check rate limit. Returns { success, limit, remaining, reset } or null if not configured.
 * @param {Ratelimit} limiter
 * @param {string} identifier - user ID or IP
 */
export async function checkRateLimit(limiter, identifier) {
  if (!limiter) return { success: true }; // permissive fallback
  try {
    return await limiter.limit(identifier);
  } catch (err) {
    console.warn('[rateLimit] Upstash error, allowing request:', err.message);
    return { success: true }; // fail open
  }
}
