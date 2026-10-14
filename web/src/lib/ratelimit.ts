// Simple fixed-window rate limiter. Uses Upstash when present, falls back to
// an in-process map so local dev still enforces limits.
const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const mem = new Map<string, { n: number; reset: number }>();

export interface Limit { limit: number; windowSec: number; }

export async function rateLimit(key: string, { limit, windowSec }: Limit) {
  const bucket = `rl:${key}:${Math.floor(Date.now() / (windowSec * 1000))}`;
  if (URL && TOKEN) {
    try {
      const r = await fetch(`${URL}/incr/${encodeURIComponent(bucket)}`, {
        headers: { Authorization: `Bearer ${TOKEN}` }, cache: 'no-store',
      });
      const j = await r.json();
      const n = Number(j.result ?? 1);
      if (n === 1) {
        await fetch(`${URL}/expire/${encodeURIComponent(bucket)}/${windowSec}`, {
          headers: { Authorization: `Bearer ${TOKEN}` }, cache: 'no-store' });
      }
      return { ok: n <= limit, remaining: Math.max(0, limit - n), count: n };
    } catch { /* fall through to memory */ }
  }
  const now = Date.now();
  const rec = mem.get(bucket);
  if (!rec || now > rec.reset) {
    mem.set(bucket, { n: 1, reset: now + windowSec * 1000 });
    return { ok: true, remaining: limit - 1, count: 1 };
  }
  rec.n++;
  return { ok: rec.n <= limit, remaining: Math.max(0, limit - rec.n), count: rec.n };
}

export function clientKey(req: Request) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip') ?? 'local';
}
