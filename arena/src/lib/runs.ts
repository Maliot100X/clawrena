// Run registry. KEY DESIGN: the game loop and the agent's LLM brain run on
// SEPARATE clocks. The game must tick at a fixed rate regardless of how slow the
// model is (GLM measured ~3.9s, DeepSeek ~1.5s, Groq ~0.4s). The brain sets an
// intent; the loop keeps stepping with the last known intent until a new one lands.
import { randomUUID } from 'crypto';
import { GridSurvival, type GameState } from '../games/grid-survival.js';
import { redis } from './redis.js';
import { think } from '../llm/brain.js';
import { openMarket, openFor, save, settle, evaluate, ledgerAppend, type Market } from './markets.js';
import { speak } from '../voice/deepgram.js';
import { persistRunStart, persistEvents, persistRunEnd } from './persist.js';

export interface LiveRun {
  id: string; agentName: string; gameSlug: string;
  mindTier: string; personality: string;
  provider?: string;
  engine: GridSurvival; state: GameState;
  interval?: NodeJS.Timeout;
  brainTimer?: NodeJS.Timeout;
  startedAt: number;
  subscribers: Set<(s: GameState) => void>;
  thoughts: { text: string; provider: string; at: number }[];
  chat?: { author: string; body: string; kind: string; at: number }[];
  replying?: boolean;
  replyQueue?: { viewer: string; text: string }[];
  lastBias: { dx: number; dy: number };
  brainBusy: boolean;
  agg: { calls: number; ms: number; fallbacks: number };
  marketIds: string[];
  marketCursor: number;
  marketLog?: { id: string; question: string; outcome: boolean; pot: number }[];
  voiceId: string;          // which Aura voice the agent speaks with
  voiceOn: boolean;         // synthesize audio for chat lines
  lastAudioId?: string;
  dbRunId?: string | null;      // Postgres Run.id (null if persistence unavailable)
  seq: number;                  // monotonic event counter for replay
  eventBuf: { seq: number; type: string; payload: any }[];     // most recent synthesized line (served via /voice/last/:runId)
}

const runs = new Map<string, LiveRun>();

export function createRun(opts: {
  agentName: string; gameSlug: string; seed?: number; targetLevel?: number;
  mindTier?: string; personality?: string;
}) {
  const id = 'r_' + randomUUID().slice(0, 8);
  const engine = new GridSurvival({
    w: 24, h: 16, seed: opts.seed ?? Math.floor(Math.random() * 1e9),
    targetLevel: opts.targetLevel ?? 15,
  });
  const run: LiveRun = {
    id, agentName: opts.agentName, gameSlug: opts.gameSlug,
    mindTier: opts.mindTier ?? 'HUMAN', personality: opts.personality ?? 'Daredevil',
    engine, state: engine.state, startedAt: Date.now(), subscribers: new Set(),
    thoughts: [], lastBias: { dx: 0, dy: 0 }, brainBusy: false,
    agg: { calls: 0, ms: 0, fallbacks: 0 },
    marketIds: [], marketCursor: 0,
    voiceId: 'server-default', voiceOn: false,
    seq: 0, eventBuf: [],
  };
  runs.set(id, run);
  return run;
}

export function startRun(id: string, tickMs = 500, useBrain = true) {
  const run = runs.get(id);
  if (!run) return null;
  if (run.interval) return run;

  // open the Postgres Run row (fire-and-forget; the game never waits on the DB)
  persistRunStart({
    arenaRunId: id, agentName: run.agentName, gameSlug: run.gameSlug,
    mindTier: run.mindTier, personality: run.personality,
    seed: run.engine['cfg']?.seed ?? 0,
  }).then(dbId => { run.dbRunId = dbId; }).catch(() => {});

  // --- game clock: fixed rate, never blocked by the model ---
  run.interval = setInterval(async () => {
    const s = run.engine.step(run.lastBias);
    // record the tick for replay
    run.seq++;
    run.eventBuf.push({ seq: run.seq, type: 'tick', payload: {
      tick: s.tick, level: s.level, hp: s.hp, maxHp: s.maxHp,
      kills: s.kills, gold: s.gold, elapsedMs: s.elapsedMs, alive: s.alive,
      x: s.x, y: s.y,
    }});
    if (run.eventBuf.length >= 20 && run.dbRunId) {
      const batch = run.eventBuf.splice(0);
      persistEvents(run.dbRunId, batch).catch(() => {});
    }
    for (const fn of run.subscribers) fn(s);
    await redis.set(`run:${id}`, {
      ...s, agentName: run.agentName, gameSlug: run.gameSlug,
      provider: run.provider, thoughts: run.thoughts.slice(-10),
    }, 300).catch(() => {});
    // --- prediction markets: resolve from state, open new ones on a cadence ---
    await tickMarkets(run).catch(() => {});

    if (run.engine.finished) {
      clearInterval(run.interval!); run.interval = undefined;
      if (run.brainTimer) { clearTimeout(run.brainTimer); run.brainTimer = undefined; }
      if (run.dbRunId && run.eventBuf.length) {
        persistEvents(run.dbRunId, run.eventBuf.splice(0)).catch(() => {});
      }
      if (run.dbRunId) {
        persistRunEnd(run.dbRunId, {
          won: run.engine.won, score: run.state.kills,
          games: {}, agentName: run.agentName, gameSlug: run.gameSlug,
          thoughts: run.thoughts.map(t => ({ text: t.text, provider: t.provider })),
        }).catch(() => {});
      }
      await redis.set(`run:${id}:final`, {
        won: run.engine.won, ...s, agentName: run.agentName,
        thoughts: run.thoughts, agg: run.agg,
      }, 3600).catch(() => {});
    }
  }, tickMs);

  if (!useBrain) return run;

  // --- brain clock: independent, slower, self-scheduling (no overlap) ---
  const beat = async () => {
    if (run.engine.finished) return;
    if (!run.brainBusy) {
      run.brainBusy = true;
      const t0 = Date.now();
      try {
        const t = await think({
          agentName: run.agentName, mindTier: run.mindTier,
          personality: run.personality, state: run.state,
        });
        run.provider = t.provider;
        run.lastBias = t.bias;
        run.agg.calls++; run.agg.ms += Date.now() - t0;
        if (t.fallback) run.agg.fallbacks++;
        run.thoughts.push({ text: t.say, provider: t.provider, at: Date.now() });
        if (run.voiceOn && t.say && !t.say.startsWith('(')) {
          // fire-and-forget: speech must never stall the game or the brain
          speak(t.say, { voiceId: run.voiceId })
            .then(buf => { run.lastAudioId = storeAudio(run.id, buf); })
            .catch(() => {});
        }
        if (run.thoughts.length > 40) run.thoughts = run.thoughts.slice(-40);
      } catch { /* think() degrades internally */ }
      finally { run.brainBusy = false; }
    }
    if (!run.engine.finished) run.brainTimer = setTimeout(beat, 50);
  };
  run.brainTimer = setTimeout(beat, 50);
  return run;
}

export const getRun = (id: string) => runs.get(id);
export const listRuns = () => [...runs.values()].map(r => ({
  id: r.id, agentName: r.agentName, gameSlug: r.gameSlug, provider: r.provider,
  alive: r.state.alive, level: r.state.level, tick: r.state.tick,
  avgBrainMs: r.agg.calls ? Math.round(r.agg.ms / r.agg.calls) : 0,
  brainCalls: r.agg.calls, fallbacks: r.agg.fallbacks,
}));
export const stopRun = (id: string) => {
  const r = runs.get(id);
  if (r?.interval) clearInterval(r.interval);
  if (r?.brainTimer) clearTimeout(r.brainTimer);
  runs.delete(id);
};


// ---- prediction market orchestration (resolved FROM game state) ----
const QUESTION_BANK: { q: string; kind: 'level'|'kills'|'survive'; thr: number }[] = [
  { q: 'Does it reach level 3?',        kind: 'level',   thr: 3  },
  { q: 'Does it reach level 5?',        kind: 'level',   thr: 5  },
  { q: 'Does it reach level 8?',        kind: 'level',   thr: 8  },
  { q: 'Does it hit 10 kills?',         kind: 'kills',   thr: 10 },
  { q: 'Does it hit 25 kills?',         kind: 'kills',   thr: 25 },
  { q: 'Does it survive 20 seconds?',   kind: 'survive', thr: 20_000 },
  { q: 'Does it survive 60 seconds?',   kind: 'survive', thr: 60_000 },
];

async function tickMarkets(run: LiveRun) {
  const s = run.state;
  const stateForEval = { level: s.level, kills: s.kills, gold: s.gold,
    elapsedMs: s.elapsedMs, alive: s.alive };

  // 1. resolve anything decidable
  for (const id of run.marketIds) {
    const m = await getMarket(id);
    if (!m || m.status !== 'OPEN') continue;
    const outcome = evaluate(m, stateForEval);
    const expired = Date.now() > m.closesAt;
    if (outcome !== null) {
      const done = settle(m, outcome);
      await save(done);
      // Ledger entry must be GROSS (+payout). The stake was already recorded as
      // -amount at bet time, so recording net here would double-count the loss.
      // Zero-sum holds because sum(payouts) === pot === sum(stakes).
      for (const b of done.bets) {
        await ledgerAppend(run.id, { marketId: done.id, bettorId: b.bettorId,
          delta: (b.payout ?? 0), reason: 'payout' });
      }
      run.marketLog = [...(run.marketLog ?? []).slice(-19),
        { id: done.id, question: done.question, outcome, pot: done.pot }];
    } else if (expired) {
      // Timed out with nothing decided -> VOID + full refund.
      // settle(m, false) refunds every bettor their stake; those refunds MUST be
      // written to the ledger or the ledger leaks negative points (sumDelta != 0).
      const done = settle(m, false);
      done.status = 'VOID';
      await save(done);
      for (const b of done.bets) {
        await ledgerAppend(run.id, { marketId: done.id, bettorId: b.bettorId,
          delta: (b.payout ?? 0), reason: 'refund' });
      }
      run.marketLog = [...(run.marketLog ?? []).slice(-19),
        { id: done.id, question: done.question, outcome: false, pot: done.pot }];
    }
  }

  // 2. keep one market open at a time, cycling the question bank
  const open = (await openFor(run.id)).filter(m => m.status === 'OPEN');
  if (open.length === 0 && !run.engine.finished) {
    const pick = QUESTION_BANK[run.marketCursor % QUESTION_BANK.length];
    run.marketCursor++;
    const m = await openMarket(run.id, {
      question: pick.q, kind: pick.kind, threshold: pick.thr, ttlMs: 25_000,
    });
    run.marketIds.push(m.id);
  }
}

async function getMarket(id: string) {
  const { get } = await import('./markets.js');
  return get(id);
}

export async function placeRunBet(runId: string, marketId: string, bettorId: string, choice: boolean, amount: number) {
  const run = runs.get(runId);
  if (!run) throw new Error('run not found');
  const { get, placeBet, ledgerAppend: la } = await import('./markets.js');
  const m = await get(marketId);
  if (!m) throw new Error('market not found');
  const updated = await placeBet(marketId, bettorId, choice, amount);
  await la(runId, { marketId, bettorId, delta: -amount, reason: 'bet' });
  return updated;
}


// in-memory audio cache; newest line per run (kept small + TTL'd by size)
const audioCache = new Map<string, { buf: Buffer; at: number }>();
function storeAudio(runId: string, buf: Buffer): string {
  const id = runId + ':' + Date.now();
  audioCache.set(id, { buf, at: Date.now() });
  // prune anything older than 2 minutes
  const cutoff = Date.now() - 120_000;
  for (const [k, v] of audioCache) if (v.at < cutoff) audioCache.delete(k);
  return id;
}
export function getAudio(id: string) { return audioCache.get(id)?.buf ?? null; }
export function latestAudio(runId: string): string | null {
  let best: string | null = null, bestAt = 0;
  for (const [k, v] of audioCache) if (k.startsWith(runId + ':') && v.at > bestAt) { best = k; bestAt = v.at; }
  return best;
}
export function setVoice(runId: string, on: boolean, voiceId?: string) {
  const r = runs.get(runId); if (!r) return null;
  r.voiceOn = on; if (voiceId) r.voiceId = voiceId;
  return { voiceOn: r.voiceOn, voiceId: r.voiceId };
}


// ---- live chat (viewers -> arena feed) ----
export function addChat(runId: string, author: string, body: string, kind = 'chat') {
  const run = runs.get(runId);
  if (!run) return null;
  const msg = { author, body: String(body).slice(0, 240), kind, at: Date.now() };
  run.chat = [...(run.chat ?? []).slice(-199), msg];
  for (const fn of run.subscribers) { try { fn(run.state); } catch {} }
  // a human spoke -> the agent answers, in character, out loud
  if (kind === 'chat' && run.replying !== true) queueReply(run, author, msg.body);
  return msg;
}

// Serialize replies so the agent never talks over itself.
async function queueReply(run: LiveRun, viewer: string, text: string) {
  if (run.replying) { run.replyQueue = [...(run.replyQueue ?? []).slice(-4), { viewer, text }]; return; }
  run.replying = true;
  const ask = { viewer, text };
  try {
    const { replyTo } = await import('../llm/brain.js');
    const recent = (run.chat ?? []).slice(-6).map(c => `${c.author}: ${c.body}`);
    const r = await replyTo({
      agentName: run.agentName, mindTier: run.mindTier, personality: run.personality,
      state: run.state, viewer: ask.viewer, message: ask.text, recent,
    });
    run.provider = r.provider;
    const reply = { author: run.agentName, body: r.say, kind: 'agent', at: Date.now() };
    run.chat = [...(run.chat ?? []).slice(-199), reply];
    run.thoughts.push({ text: r.say, provider: r.provider, at: Date.now() });
    for (const fn of run.subscribers) { try { fn(run.state); } catch {} }
    // speak it — fire and forget so the game never stalls
    if (run.voiceOn) {
      speak(r.say, { voiceId: run.voiceId })
        .then(buf => { run.lastAudioId = storeAudio(run.id, buf); })
        .catch(() => {});
    }
  } catch { /* reply failed — stay silent, keep playing */ }
  run.replying = false;
  const next = (run.replyQueue ?? []).shift();
  if (next) { run.replyQueue = run.replyQueue ?? []; queueReply(run, next.viewer, next.text); }
}
export function getChat(runId: string) {
  return runs.get(runId)?.chat ?? [];
}
