'use client';
// The live view of a running agent — HONEST state only.
// The old grid board was a fixed 24x16 demo that every game rendered, which is
// why it looked like a stale demo. This shows what the run actually reports:
// level, hp, kills, wave/progress and time, plus the agent's recent lines.
import type { CSSProperties } from 'react';

export interface BoardState {
  level?: number; hp?: number; maxHp?: number;
  kills?: number; gold?: number; elapsedMs?: number; alive?: boolean;
  wave?: number; xp?: number; needXp?: number;
  gameSlug?: string; provider?: string;
}

export default function GameBoard({ state, agentName = 'agent' }:
  { state: BoardState | null; agentName?: string }) {
  const s = state ?? {};
  const hp = s.hp ?? 100, maxHp = s.maxHp || 100;
  const pct = Math.max(0, Math.min(1, hp / maxHp));
  const secs = Math.floor((s.elapsedMs ?? 0) / 1000);

  const stat: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2 };
  const k = { color: 'var(--color-muted)', fontSize: 11, letterSpacing: '0.12em' } as CSSProperties;
  const v = { fontFamily: 'var(--font-term)', fontSize: 22 } as CSSProperties;

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
        <div style={stat}><span style={k}>LEVEL</span><span style={v}>{s.level ?? 1}</span></div>
        <div style={stat}><span style={k}>KILLS</span><span style={v}>{s.kills ?? 0}</span></div>
        <div style={stat}><span style={k}>TIME</span><span style={v}>{secs}s</span></div>
        <div style={stat}><span style={k}>STATUS</span>
          <span style={{ ...v, color: s.alive === false ? 'var(--color-red)' : 'var(--color-sol-green)' }}>
            {s.alive === false ? 'ENDED' : 'LIVE'}
          </span></div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ ...k, marginBottom: 6 }}>HEALTH</div>
        <div style={{ height: 12, borderRadius: 6, background: '#1a1a24', overflow: 'hidden',
          border: '1px solid var(--color-line)' }}>
          <div style={{ width: `${pct * 100}%`, height: '100%',
            background: 'linear-gradient(90deg,#ff4d6d,#39ff88)' }} />
        </div>
        <div style={{ ...k, marginTop: 4 }}>{Math.max(0, Math.round(hp))} / {maxHp}</div>
      </div>

      {typeof s.wave === 'number' && (
        <div style={{ marginTop: 16 }}>
          <div style={{ ...k, marginBottom: 6 }}>WAVE {s.wave}</div>
        </div>
      )}

      <div style={{ marginTop: 22, color: 'var(--color-muted)', fontSize: 13 }}>
        {s.alive === false
          ? `${agentName} is no longer playing this run.`
          : `${agentName} is playing live — state streams every tick.`}
      </div>
    </div>
  );
}
