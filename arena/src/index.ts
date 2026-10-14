import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
// Local dev reads .env.local; on Railway the platform injects real env vars.
// dotenv only fills gaps — it never overrides what the platform provides.
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env.local') });
import Fastify from 'fastify';

// accept raw audio for STT
const AUDIO_TYPES = ['audio/mpeg','audio/wav','audio/webm','audio/ogg','audio/mp4','application/octet-stream'];

import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { redis } from './lib/redis.js';
import { createRun, startRun, getRun, listRuns, stopRun, placeRunBet, getAudio, latestAudio, setVoice } from './lib/runs.js';
import { openFor, ledgerFor } from './lib/markets.js';
import { speak, transcribe, listVoices } from './voice/deepgram.js';

const app = Fastify({ logger: { level: 'info' } });

// register a raw body parser for audio BEFORE routes
app.addContentTypeParser(AUDIO_TYPES,
  { parseAs: 'buffer' },
  (_req, body, done) => done(null, body));

await app.register(cors, { origin: true });
await app.register(websocket);

// ---- REST ----
app.get('/health', async () => {
  let redisOk = false;
  try { redisOk = (await redis.ping()) === 'PONG'; } catch {}
  return { ok: true, redis: redisOk, runs: listRuns().length, ts: Date.now() };
});

app.get('/runs', async () => ({ runs: listRuns() }));

// --- brain test (used by the create-agent flow) ---
// Runs ONE real think() turn against a representative game state so the user
// sees which provider answers and what the agent would say.
app.post('/brain/test', async (req, reply) => {
  const b = (req.body ?? {}) as any;
  try {
    const { think } = await import('./llm/brain.js');
    const t = await think({
      agentName: b.agentName ?? 'agent',
      mindTier: b.mindTier ?? 'HUMAN',
      personality: b.personality ?? 'Daredevil',
      state: { tick: 42, level: 3, hp: 76, maxHp: 120, kills: 14, gold: 42,
               elapsedMs: 9000, x: 5, y: 5, alive: true,
               enemies: [{ x: 6, y: 5 }, { x: 4, y: 6 }, { x: 5, y: 4 }], log: [] } as any,
    });
    return { say: t.say, provider: t.provider, bias: t.bias, fallback: t.fallback ?? false };
  } catch (e: any) {
    return reply.code(502).send({ error: e.message });
  }
});

// --- voice ---
// stream the most recent spoken line for a run
app.get('/runs/:id/voice', async (req, reply) => {
  const { id } = req.params as { id: string };
  const audioId = latestAudio(id);
  if (!audioId) return reply.code(404).send({ error: 'no audio yet' });
  const buf = getAudio(audioId);
  if (!buf) return reply.code(404).send({ error: 'expired' });
  return reply.header('content-type','audio/mpeg')
    .header('cache-control','no-store').send(buf);
});

// toggle agent speech for a run
app.post('/runs/:id/voice', async (req, reply) => {
  const { id } = req.params as { id: string };
  const b = (req.body ?? {}) as any;
  const out = setVoice(id, !!b.on, b.voiceId);
  if (!out) return reply.code(404).send({ error: 'run not found' });
  return out;
});

app.get('/voices', async () => ({ voices: listVoices() }));

// TTS: text -> mp3 (the agent speaks a chat line)
app.post('/voice/speak', async (req, reply) => {
  const b = (req.body ?? {}) as any;
  const text = String(b.text ?? '').slice(0, 1800);
  if (!text) return reply.code(400).send({ error: 'text required' });
  try {
    const mp3 = await speak(text, { voiceId: b.voiceId, emotion: b.emotion });
    return reply.header('content-type', 'audio/mpeg')
      .header('cache-control', 'no-store').send(mp3);
  } catch (e: any) {
    return reply.code(502).send({ error: e.message });
  }
});

// STT: audio -> text (a viewer speaks a command)
app.post('/voice/listen', async (req, reply) => {
  try {
    const ct = String(req.headers['content-type'] ?? 'audio/mpeg');
    const buf = Buffer.isBuffer(req.body) ? req.body
      : Buffer.from(req.body as any ?? '');
    if (!buf.length) return reply.code(400).send({ error: 'empty audio body' });
    const out = await transcribe(buf, ct);
    return out;
  } catch (e: any) {
    return reply.code(502).send({ error: e.message });
  }
});

// --- prediction markets ---
app.get('/runs/:id/markets', async (req) => {
  const { id } = req.params as { id: string };
  return { markets: await openFor(id) };
});

app.post('/runs/:id/bets', async (req, reply) => {
  const { id } = req.params as { id: string };
  const body = (req.body ?? {}) as any;
  try {
    const m = await placeRunBet(id, body.marketId, body.bettorId ?? 'anon',
      !!body.choice, Number(body.amount));
    return { ok: true, market: m };
  } catch (e: any) {
    return reply.code(400).send({ error: e.message });
  }
});

app.get('/runs/:id/ledger', async (req) => {
  const { id } = req.params as { id: string };
  const entries = await ledgerFor(id);
  // every point movement sums to zero across bettors + house
  const sum = entries.reduce((a: number, e: any) => a + e.delta, 0);
  return { entries, count: entries.length, sumDelta: sum };
});

// agent thoughts feed (what the agent is saying on stream)
app.get('/runs/:id/thoughts', async (req) => {
  const { id } = req.params as { id: string };
  const r = getRun(id);
  return { id, provider: r?.provider ?? null, thoughts: r?.thoughts ?? [] };
});

app.post('/runs', async (req, reply) => {
  const body = (req.body ?? {}) as any;
  const run = createRun({
    agentName: body.agentName ?? 'byteraa',
    gameSlug: body.gameSlug ?? 'grid-survival',
    seed: body.seed,
    targetLevel: body.targetLevel,
    mindTier: body.mindTier,
    personality: body.personality,
  });
  startRun(run.id, body.tickMs ?? 500, body.brain !== false);
  return reply.code(201).send({ id: run.id, agentName: run.agentName, gameSlug: run.gameSlug });
});

app.get('/runs/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  const r = getRun(id);
  if (r) return { source: 'live', ...r.state };
  const cached = await redis.get(`run:${id}`);
  if (cached) return { source: 'redis', ...(cached as object) };
  const final = await redis.get(`run:${id}:final`);
  if (final) return { source: 'final', ...(final as object) };
  return reply.code(404).send({ error: 'run not found' });
});

app.delete('/runs/:id', async (req) => {
  const { id } = req.params as { id: string };
  stopRun(id);
  await redis.del(`run:${id}`).catch(()=>{});
  return { stopped: id };
});

// ---- WebSocket: live run stream ----
app.register(async (f) => {
  f.get('/ws/run/:id', { websocket: true }, (socket, req) => {
    const { id } = req.params as { id: string };
    const run = getRun(id);
    if (!run) { socket.send(JSON.stringify({ type: 'error', message: 'run not found' })); socket.close(); return; }
    socket.send(JSON.stringify({ type: 'hello', id, agentName: run.agentName, gameSlug: run.gameSlug }));
    socket.send(JSON.stringify({ type: 'state', state: run.state }));
    const fn = (s: any) => { try { socket.send(JSON.stringify({ type: 'state', state: s })); } catch {} };
    run.subscribers.add(fn);
    socket.on('close', () => run.subscribers.delete(fn));
    socket.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ping') socket.send(JSON.stringify({ type: 'pong' }));
      } catch {}
    });
  });
});

const port = Number(process.env.ARENA_PORT ?? 4100);
app.listen({ port, host: '0.0.0.0' })
  .then(() => app.log.info(`ClawRena arena on :${port}`))
  .catch(err => { app.log.error(err); process.exit(1); });
