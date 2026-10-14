'use client';
// Replay playback: replay RunEvent rows on a scrubber, showing the state at each tick.
import { useEffect, useMemo, useRef, useState } from 'react';

export interface ReplayEvent { seq: number; type: string; payload: any }

export default function ReplayPlayer({ events, agent, game }:
  { events: ReplayEvent[]; agent: string; game: string }) {
  const ticks = useMemo(() => events.filter(e => e.type === 'tick'), [events]);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!playing) { if (timer.current) clearInterval(timer.current); return; }
    timer.current = setInterval(() => {
      setI(prev => {
        if (prev >= ticks.length - 1) { setPlaying(false); return prev; }
        return prev + 1;
      });
    }, 120);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, ticks.length]);

  const cur = ticks[i]?.payload ?? {};

  if (!ticks.length) {
    return <div style={{ padding: 20, color: 'var(--color-muted)' }}>
      No replay events recorded for this run.
    </div>;
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ position: 'relative', height: 300, borderRadius: 'var(--radius-panel)',
        background: 'linear-gradient(160deg,#0b0b11,#121218)',
        border: '1px solid var(--color-line)', overflow: 'hidden' }}>
        <svg viewBox="0 0 240 160" style={{ width: '100%', height: '100%' }}>
          <rect width="240" height="160" fill="transparent" />
          <circle cx={cur.x * 10 + 5} cy={cur.y * 10 + 5} r="5" fill="#14f195" />
          <text x={cur.x * 10 + 12} y={cur.y * 10 + 9} fill="#f1ebe0" fontSize="8">{agent}</text>
        </svg>
        <div style={{ position: 'absolute', top: 10, left: 12, fontFamily: 'var(--font-term)',
          fontSize: 18, color: 'var(--color-ink)' }}>
          lvl {cur.level} · {Math.floor((cur.elapsedMs ?? 0)/1000)}s
        </div>
        <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 12,
          color: 'var(--color-muted)' }}>
          {cur.kills} kills · {cur.gold} gold
        </div>
      </div>

      <div style={{ height: 8, borderRadius: 4, background: '#22222c', overflow: 'hidden' }}>
        <div style={{ width: `${((cur.hp ?? 0) / (cur.maxHp || 100)) * 100}%`, height: '100%',
          background: (cur.hp ?? 100) < (cur.maxHp ?? 100) * 0.4
            ? 'var(--color-red)' : 'var(--color-sol-green)' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => setPlaying(p => !p)} style={{ padding: '8px 16px', border: 0,
          borderRadius: 10, background: '#fff', color: '#0a0a0f', fontWeight: 600, cursor: 'pointer' }}>
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        <input type="range" min={0} max={Math.max(0, ticks.length - 1)} value={i}
          onChange={e => setI(Number(e.target.value))} style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--font-term)', fontSize: 15, minWidth: 90 }}>
          {i + 1} / {ticks.length}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
        {agent} · {game} — replayed from {events.length} recorded events
      </div>
    </div>
  );
}
