// Upstash Redis over REST (no TCP needed in this env).
// NOTE: read env LAZILY. Module-level `const URL = process.env...` would capture
// undefined because dotenv runs after the import graph is evaluated.
const urls = () => {
  const u = process.env.UPSTASH_REDIS_REST_URL;
  const t = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!u || !t) throw new Error('UPSTASH_REDIS_REST_URL/TOKEN not loaded');
  return { u, t };
};

async function cmd(...args: (string|number)[]): Promise<any> {
  const { u: URL, t: TOKEN } = urls();
  const r = await fetch(`${URL}/${args.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: 'no-store',
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

export const redis = {
  set: (k: string, v: unknown, ttlSec?: number) =>
    ttlSec ? cmd('set', k, JSON.stringify(v), 'EX', ttlSec)
           : cmd('set', k, JSON.stringify(v)),
  get: async <T>(k: string): Promise<T | null> => {
    const v = await cmd('get', k);
    return v == null ? null : (JSON.parse(v) as T);
  },
  del: (k: string) => cmd('del', k),
  sadd: (k: string, m: string) => cmd('sadd', k, m),
  srem: (k: string, m: string) => cmd('srem', k, m),
  smembers: (k: string): Promise<string[]> => cmd('smembers', k),
  publish: (ch: string, msg: unknown) => cmd('publish', ch, JSON.stringify(msg)),
  ping: () => cmd('ping'),
};
