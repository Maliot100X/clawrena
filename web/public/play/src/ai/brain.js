// The autopilot brain. Provider-agnostic:
//   1. If an LLM endpoint is configured AND reachable, ask it to choose.
//   2. Otherwise fall back to the deterministic heuristic — ALWAYS works.
// Drives itself off the game's own decision protocol (see protocol.js).

import { state } from '../state.js';
import { pickCard, moveIntent } from './heuristic.js';
import { normalizeStrategy, STRATEGIES } from './strategies.js';

let cfg = {
  endpoint: null,     // e.g. 'https://api.groq.com/openai/v1/chat/completions'
  apiKey: null,
  model: null,
  timeoutMs: 1200,
  enabled: false,
};

export function configureBrain(options = {}) {
  cfg = { ...cfg, ...options, enabled: !!options.endpoint };
}

export function brainConfig() { return { ...cfg, apiKey: cfg.apiKey ? '***' : null }; }

// Ask the LLM to pick an option index. Returns null on any failure so the
// caller falls back to the heuristic.
async function askLLM(kind, options, context) {
  if (!cfg.endpoint || !cfg.apiKey || !options?.length) return null;
  const sys = 'You are playing a top-down arena survival game. Choose exactly ONE option index. ' +
    'Reply with ONLY the integer index, no prose.';
  const user = JSON.stringify({ kind, strategy: state.strategy, context,
    options: options.map((o, i) => ({ i, name: o.name ?? o.label ?? String(o), desc: o.desc ?? '' })) });
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), cfg.timeoutMs);
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model, temperature: 0.2, max_tokens: 8,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      }),
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    const txt = data?.choices?.[0]?.message?.content ?? '';
    const n = parseInt(String(txt).replace(/[^0-9]/g, ''), 10);
    return Number.isInteger(n) && n >= 0 && n < options.length ? n : null;
  } catch { return null; }
}

// Decide a level-up / relic choice. Tries LLM, falls back to heuristic.
export async function decideChoice(kind, options, context) {
  const llm = await askLLM(kind, options, context);
  if (llm !== null) return { index: llm, source: 'llm' };
  const idx = pickCard(options, state.strategy);
  return { index: idx, source: 'heuristic' };
}

// Per-frame movement intent while autopilot is on.
export function brainMove(player, enemies, pickups, viewport) {
  return moveIntent(player, enemies, pickups, normalizeStrategy(state.strategy), viewport);
}

export function setStrategy(name) {
  state.strategy = normalizeStrategy(name);
  return STRATEGIES[state.strategy];
}

export function strategyLabel() {
  return STRATEGIES[normalizeStrategy(state.strategy)]?.label ?? 'SURVIVOR';
}
