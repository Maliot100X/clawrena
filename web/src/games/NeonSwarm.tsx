'use client';
// Neon Swarm — 3D survival arena. The React shell owns the HUD, the level-up
// overlay, the game-over screen and the LLM brain hookup; the engine
// (neon/NeonSwarm.ts) owns the world and the loop.
import { useEffect, useRef, useState } from 'react';
import { NeonSwarm as Engine } from './neon/NeonSwarm';
import type { HudState, PlayerPower } from './neon/types';

export default function NeonSwarm({ runId, agentName }: { runId?: string; agentName?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<Engine | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [choices, setChoices] = useState<PlayerPower[] | null>(null);
  const [say, setSay] = useState('');
  const [driving, setDriving] = useState(false);

  useEffect(() => {
    const el = host.current; if (!el) return;
    const g = new Engine(el, {
      onHud: h => setHud({ ...h }),
      onLevelUp: opts => setChoices(opts),
    });
    game.current = g; g.start();
    return () => { g.destroy(); game.current = null; };
  }, []);

  // --- LLM brain hookup: poll the arena for this agent's steer + line -------
  useEffect(() => {
    if (!runId) return;
    let stop = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/arena/live/${runId}`);
        const j = await r.json();
        if (j.steer) { game.current?.setSteer(j.steer); setDriving(true); }
        if (j.say) setSay(j.say);
      } catch {}
      if (!stop) setTimeout(poll, 700);
    };
    poll();
    return () => { stop = true; };
  }, [runId]);

  const pick = (p: PlayerPower) => { game.current?.choose(p); setChoices(null); };
  const restart = () => location.reload();

  return (
    <div style={{ position: 'relative', borderRadius: 'var(--radius-panel)', overflow: 'hidden',
      background: '#05060c', border: '1px solid var(--color-line)' }}>
      <div ref={host} style={{ width: '100%', height: 460 }} />

      {/* ---- HUD ---- */}
      <div style={{ position: 'absolute', top: 10, left: 12, right: 12, display: 'flex',
        justifyContent: 'space-between', pointerEvents: 'none',
        fontFamily: 'var(--font-term)', fontSize: 13, color: '#dfe9ff' }}>
        <div>
          <div style={{ fontWeight: 700, letterSpacing: 1 }}>NEON SWARM</div>
          <div style={{ opacity: .85 }}>LV {hud?.level ?? 1} · WAVE {hud?.wave ?? 1} · {hud?.elapsed ?? 0}s</div>
          <div style={{ marginTop: 6, width: 220, height: 12, background: '#171a26',
            borderRadius: 6, overflow: 'hidden', border: '1px solid #2a2f42' }}>
            <div style={{ width: `${((hud?.hp ?? 100) / (hud?.maxHp ?? 100)) * 100}%`, height: '100%',
              background: 'linear-gradient(90deg,#ff3b6b,#39ff88)' }} />
          </div>
          <div style={{ marginTop: 4, width: 220, height: 8, background: '#171a26',
            borderRadius: 6, overflow: 'hidden', border: '1px solid #2a2f42' }}>
            <div style={{ width: `${((hud?.xp ?? 0) / (hud?.needXp ?? 5)) * 100}%`, height: '100%',
              background: '#00e5ff' }} />
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div>KILLS {hud?.kills ?? 0}</div>
          <div style={{ opacity: .8 }}>
            HP {hud?.hp ?? 100}/{hud?.maxHp ?? 100}
          </div>
          <div style={{ marginTop: 4, color: driving ? '#39ff88' : '#8b93a7' }}>
            {driving ? '[AI driving]' : '[you / autopilot]'}
          </div>
          {hud?.powers?.length ? (
            <div style={{ marginTop: 4, fontSize: 11, opacity: .9 }}>
              {hud.powers.map(p => `${p.name} ${p.level}`).join(' · ')}
            </div>
          ) : null}
        </div>
      </div>

      {say && (
        <div style={{ position: 'absolute', bottom: 10, left: 12, right: 12, fontFamily: 'var(--font-term)',
          fontSize: 13, color: '#39ff88', pointerEvents: 'none' }}>
          {agentName ?? 'agent'}: {say}
        </div>
      )}

      {/* ---- level up ---- */}
      {choices && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,6,12,.82)',
          display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-term)', fontSize: 22, color: '#39ff88',
              letterSpacing: 2, marginBottom: 14 }}>LEVEL UP — choose a power</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              {choices.map((c, i) => (
                <button key={c.kind} onClick={() => pick(c)}
                  style={{ width: 190, padding: '14px 12px', borderRadius: 12, cursor: 'pointer',
                    border: '1px solid #2a2f42', background: '#11152400', color: '#dfe9ff',
                    fontFamily: 'var(--font-term)', backdropFilter: 'blur(2px)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#1a2033')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{c.name}</div>
                  <div style={{ fontSize: 12, opacity: .8, marginTop: 4 }}>
                    {c.kind === 'damage' ? 'hit harder' : c.kind === 'firerate' ? 'shoot faster'
                      : c.kind === 'speed' ? 'move faster' : c.kind === 'multishot' ? '+1 projectile'
                      : c.kind === 'magnet' ? 'pull shards' : 'heal over time'}
                  </div>
                  <div style={{ fontSize: 11, opacity: .6, marginTop: 6 }}>press {i + 1}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- game over ---- */}
      {hud?.over && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,6,12,.86)',
          display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center', fontFamily: 'var(--font-term)', color: '#dfe9ff' }}>
            <div style={{ fontSize: 30, color: '#ff3b6b', letterSpacing: 3 }}>SYSTEM DOWN</div>
            <div style={{ marginTop: 12, fontSize: 15 }}>
              survived {hud.elapsed}s · wave {hud.wave} · level {hud.level} · {hud.kills} kills
            </div>
            <button onClick={restart} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 999,
              border: 0, cursor: 'pointer', fontWeight: 700,
              background: 'linear-gradient(90deg,#00e5ff,#39ff88)', color: '#05060c' }}>
              ↻ run again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
