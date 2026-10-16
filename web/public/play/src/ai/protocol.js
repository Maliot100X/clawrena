// The agent protocol surface. Exposes window.SurvivorsAPI v2 and translates
// window `message` events into game actions — the same shape the reference
// title uses, so an external agent (or our own brain) can drive the run.

import { state } from '../state.js';
import { setStrategy } from './brain.js';
import { applyChoice } from '../levelup.js';

let seq = 0;
const pending = new Map();
const listeners = new Map();

function emit(type, payload) {
  listeners.get(type)?.forEach((fn) => { try { fn(payload); } catch {} });
  try {
    if (window.parent && window.parent !== window)
      window.parent.postMessage({ type: 'survivors:' + type, payload }, '*');
  } catch {}
}

export function on(type, fn) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(fn);
}
export function off(type, fn) { listeners.get(type)?.delete(fn); }

// Emit a decision request and resolve to the chosen index.
export function requestDecision(kind, options, ctx = {}) {
  const requestId = ++seq;
  const payload = { requestId, kind, options, context: ctx };
  emit('decision', payload);
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      if (pending.has(requestId)) { pending.delete(requestId); resolve(0); }
    }, state.decisionTimeoutMs ?? 900);
    pending.set(requestId, (i) => {
      clearTimeout(t);
      resolve(Math.max(0, Math.min(options.length - 1, i)));
    });
  });
}

export function choose(requestId, index) {
  pending.get(requestId)?.(index);
}

// Wire the inbound message protocol + window API.
export function installProtocol() {
  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || typeof d !== 'object') return;
    switch (d.type) {
      case 'survivors:choose':
        if (typeof d.requestId === 'number' && typeof d.index === 'number')
          choose(d.requestId, d.index);
        break;
      case 'survivors:set_autopilot': state.autopilot = !!d.enabled; break;
      case 'survivors:set_decision_mode':
        state.decisionMode = d.mode === 'external' ? 'external' : 'auto';
        break;
      case 'survivors:set_strategy': setStrategy(d.strategy); break;
      case 'survivors:set_decision_timeout':
        state.decisionTimeoutMs = Math.round(Number(d.seconds) * 1000) || 900;
        break;
      case 'survivors:set_coin_timeout':
        state.coinTimeoutMs = Math.round(Number(d.seconds) * 1000) || 900;
        break;
    }
  });

  window.SurvivorsAPI = {
    version: 2,
    setAutopilot: (v) => { state.autopilot = !!v; },
    setDecisionMode: (m) => { state.decisionMode = m; },
    setAutoRestart: (v) => { state.autoRestart = !!v; },
    setStrategy: (s) => setStrategy(s),
    getStrategy: () => state.strategy,
    setDecisionTimeout: (s) => { state.decisionTimeoutMs = Math.round(s * 1000); },
    setCoinDecisionTimeout: (s) => { state.coinTimeoutMs = Math.round(s * 1000); },
    deploy: (o = {}) => {
      if (o.strategy) setStrategy(o.strategy);
      if (o.decisionMode) state.decisionMode = o.decisionMode;
      state.autopilot = true;
      return { strategy: state.strategy, decisionMode: state.decisionMode };
    },
    choose,
    on, off,
    applyChoice,
    // Live readout for an external agent (or a test harness): scene, player
    // vitals, counts and a compact enemy list with per-enemy motion.
    // Finish the current run (agent / admin use). Goes through the normal
    // endRun path so gold, points and the leaderboard all update.
    endRun: (win = false) => { try { window.__endRun?.(!!win); return true; } catch { return false; } },
    getState: () => ({
      scene: state.scene,
      elapsed: Math.round(state.elapsed ?? 0),
      kills: state.player?.kills ?? 0,
      level: state.player?.level ?? 1,
      player: {
        x: Math.round(state.player?.x ?? 0),
        y: Math.round(state.player?.y ?? 0),
        hp: Math.round(state.player?.hp ?? 0),
        maxHp: Math.round(state.player?.maxHp ?? 0),
        alive: !!state.player?.alive,
      },
      enemyCount: (state.enemies ?? []).filter((e) => e.alive).length,
      enemies: (state.enemies ?? []).filter((e) => e.alive).slice(0, 60).map((e) => ({
        id: e.def?.id,
        x: Math.round(e.x),
        y: Math.round(e.y),
        hp: Math.round(e.hp),
        speed: Math.round(Math.hypot(e.vx ?? 0, e.vy ?? 0)),
      })),
      props: (state.props ?? []).length,
      boss: state.bossRef ? { id: state.bossRef.def?.id, hp: Math.round(state.bossRef.hp) } : null,
    }),
  };
  state.decisionMode = 'auto';
  state.decisionTimeoutMs = 900;
}

// Read URL params: ?agent=1&decisions=external&strategy=survivor
export function applyUrlParams() {
  const q = new URLSearchParams(location.search);
  if (q.get('agent') === '1') { state.autopilot = true; state.autoRestart = true; }
  const dec = q.get('decisions');
  if (dec) state.decisionMode = dec === 'external' ? 'external' : 'auto';
  const st = q.get('strategy');
  if (st) setStrategy(st);
}
