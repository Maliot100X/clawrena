'use client';
// The live game board — renders the arena grid, the agent, and enemies,
// updating every tick from the WebSocket. This is what "the agent playing"
// actually looks like.
import type { CSSProperties } from 'react';

export interface BoardState {
  x?: number; y?: number; w?: number; h?: number;
  enemies?: { x: number; y: number }[];
  level?: number; hp?: number; maxHp?: number;
  kills?: number; gold?: number; elapsedMs?: number; alive?: boolean;
}

const W = 24, H = 16;   // matches the arena engine grid
const CELL = 26;

export default function GameBoard({ state, agentName = 'agent' }:
  { state: BoardState | null; agentName?: string }) {
  const s = state ?? {};
  const w = s.w ?? W, h = s.h ?? H;
  const px = s.x ?? 12, py = s.y ?? 8;
  const enemies = s.enemies ?? [];
  const pct = Math.max(0, Math.min(1, (s.hp ?? 100) / (s.maxHp || 100)));

  const cell: CSSProperties = { position: 'absolute', width: CELL - 4, height: CELL - 4,
    borderRadius: 5, transition: 'all .35s var(--ease-spring)' };

  return (
    <div style={{ padding: 14 }}>
      {/* HUD */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 10, fontFamily: 'var(--font-term)', fontSize: 18 }}>
        <span>lvl {s.level ?? 1} · {Math.floor((s.elapsedMs ?? 0) / 1000)}s</span>
        <span style={{ color: 'var(--color-muted)', fontSize: 14 }}>
          {s.kills ?? 0} kills · {s.gold ?? 0} gold
        </span>
      </div>

      {/* board */}
      <div style={{ position: 'relative', width: w * CELL, height: h * CELL,
        margin: '0 auto', borderRadius: 14,
        background: 'radial-gradient(30rem 20rem at 50% 0%, rgba(153,69,255,0.10), transparent 70%), #08080c',
        border: '1px solid var(--color-line)', overflow: 'hidden',
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: `${CELL}px ${CELL}px` }}>
        {/* enemies */}
        {enemies.map((e, i) => (
          <div key={i} style={{ ...cell, left: e.x * CELL + 2, top: e.y * CELL + 2,
            background: 'var(--color-red)', opacity: 0.85,
            boxShadow: '0 0 12px -4px var(--color-red)' }} />
        ))}
        {/* the agent */}
        <div style={{ ...cell, left: px * CELL + 2, top: py * CELL + 2,
          background: 'linear-gradient(140deg,var(--color-sol-purple),var(--color-sol-green))',
          boxShadow: '0 0 20px -4px var(--color-sol-green)' }} />
        {/* death overlay */}
        {s.alive === false && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
            background: 'rgba(5,5,7,0.72)', backdropFilter: 'blur(3px)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-arcade)', fontSize: 14, color: 'var(--color-red)' }}>
                RUN ENDED
              </div>
              <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 8 }}>
                {agentName} · level {s.level} · {s.kills} kills
              </div>
            </div>
          </div>
        )}
      </div>

      {/* hp bar */}
      <div style={{ maxWidth: w * CELL, margin: '12px auto 0' }}>
        <div style={{ height: 8, borderRadius: 4, background: '#22222c', overflow: 'hidden' }}>
          <div style={{ width: `${pct * 100}%`, height: '100%', transition: 'width .35s var(--ease-spring)',
            background: pct < 0.4 ? 'var(--color-red)' : 'var(--color-sol-green)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12,
          color: 'var(--color-muted)' }}>
          <span>HP {s.hp ?? 100}/{s.maxHp ?? 100}</span>
          <span>{s.enemies?.length ?? 0} enemies on the board</span>
        </div>
      </div>
    </div>
  );
}
