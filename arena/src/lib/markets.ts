// Prediction markets resolved FROM GAME STATE (mirrors the reference's
// "ClawRena resolves every prediction from the game itself").
// Points, not money. Settlement must be strictly zero-sum.
import { redis } from './redis.js';

export type MarketKind = 'level' | 'kills' | 'survive' | 'profit';
export interface Market {
  id: string; runId: string; question: string; kind: MarketKind;
  threshold: number; status: 'OPEN' | 'CLOSED' | 'RESOLVED' | 'VOID';
  pot: number; yes: number; no: number; outcome: boolean | null;
  openedAt: number; closesAt: number;
  bets: Bet[];
}
export interface Bet {
  bettorId: string; choice: boolean; amount: number; weight: number;
  payout?: number; settled: boolean; at: number;
}

const key = (id: string) => `market:${id}`;
const openKey = (runId: string) => `markets:open:${runId}`;

/** Softmax-ish weighting so "first in weighs the most" (as their UI states). */
function weightFor(m: Market, at: number): number {
  const life = Math.max(1, m.closesAt - m.openedAt);
  const elapsed = Math.min(life, Math.max(0, at - m.openedAt));
  return 1 + 1.5 * (1 - elapsed / life);   // 2.5x at open -> 1.0x at close
}

export async function openMarket(runId: string, opts: {
  question: string; kind: MarketKind; threshold: number; ttlMs?: number;
}): Promise<Market> {
  const now = Date.now();
  const m: Market = {
    id: 'm_' + Math.random().toString(36).slice(2, 9),
    runId, question: opts.question, kind: opts.kind, threshold: opts.threshold,
    status: 'OPEN', pot: 0, yes: 0, no: 0, outcome: null,
    openedAt: now, closesAt: now + (opts.ttlMs ?? 30_000),
    bets: [],
  };
  await save(m);
  const list = (await redis.get<string[]>(openKey(runId))) ?? [];
  list.push(m.id);
  await redis.set(openKey(runId), list, 3600);
  return m;
}

export async function placeBet(marketId: string, bettorId: string, choice: boolean, amount: number) {
  const m = await get(marketId);
  if (!m) throw new Error('market not found');
  if (m.status !== 'OPEN') throw new Error('market not open');
  if (amount <= 0) throw new Error('amount must be positive');
  const now = Date.now();
  if (now > m.closesAt) throw new Error('market closed');
  const w = weightFor(m, now);
  m.bets.push({ bettorId, choice, amount, weight: w, settled: false, at: now });
  m.pot += amount;
  if (choice) m.yes += amount; else m.no += amount;
  await save(m);
  return m;
}

/** Evaluate a market against live game state. Returns true/false or null if unresolved. */
export function evaluate(m: Market, s: {
  level: number; kills: number; gold: number; elapsedMs: number; alive: boolean;
}): boolean | null {
  switch (m.kind) {
    case 'level':   if (s.level >= m.threshold) return true;
                    return s.alive ? null : false;
    case 'kills':   if (s.kills >= m.threshold) return true;
                    return s.alive ? null : false;
    case 'survive': if (s.elapsedMs >= m.threshold) return true;
                    return s.alive ? null : false;
    case 'profit':  if (s.gold >= m.threshold) return true;
                    return s.alive ? null : false;
  }
}

/** Settle: winners split the pot proportionally to amount*weight. Zero-sum. */
export function settle(m: Market, outcome: boolean): Market {
  const winners = m.bets.filter(b => b.choice === outcome);
  const totalW = winners.reduce((a, b) => a + b.amount * b.weight, 0);
  if (winners.length === 0 || totalW === 0) {
    // nobody won — refund everyone (still zero-sum)
    for (const b of m.bets) { b.payout = b.amount; b.settled = true; }
  } else {
    let paid = 0;
    winners.forEach((b, i) => {
      const share = i === winners.length - 1
        ? m.pot - paid                                   // last winner absorbs rounding
        : Math.floor(m.pot * ((b.amount * b.weight) / totalW));
      b.payout = share; paid += share; b.settled = true;
    });
    for (const b of m.bets.filter(b => b.choice !== outcome)) { b.payout = 0; b.settled = true; }
  }
  m.outcome = outcome;
  m.status = 'RESOLVED';
  return m;
}

export async function get(id: string): Promise<Market | null> { return redis.get<Market>(key(id)); }
export async function save(m: Market) { await redis.set(key(m.id), m, 3600); }
export async function openFor(runId: string): Promise<Market[]> {
  const ids = (await redis.get<string[]>(openKey(runId))) ?? [];
  const out: Market[] = [];
  for (const id of ids) { const m = await get(id); if (m) out.push(m); }
  return out;
}

/** Ledger helper: every point movement is recorded; sum of deltas must be 0. */
export async function ledgerAppend(runId: string, entry: {
  marketId: string; bettorId: string; delta: number; reason: string;
}) {
  const lk = `ledger:${runId}`;
  const cur = (await redis.get<any[]>(lk)) ?? [];
  cur.push({ ...entry, at: Date.now() });
  await redis.set(lk, cur, 86400);
}
export async function ledgerFor(runId: string): Promise<any[]> {
  return (await redis.get<any[]>(`ledger:${runId}`)) ?? [];
}
