'use client';
// Sets the game this agent plays. Reads the REAL games from the database
// (kind=NATIVE) via /api/games/playable — no hardcoded list.
import { useState, useEffect } from 'react';

type Game = { slug: string; name: string };

export default function AgentGamePicker({ handle, initial }:
  { handle: string; initial: string | null }) {
  const [game, setGame] = useState<string | null>(initial);
  const [games, setGames] = useState<Game[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/games/playable').then(r => r.json())
      .then(j => setGames(j.games ?? [])).catch(() => {});
  }, []);

  async function pick(slug: string) {
    setBusy(slug); setErr('');
    try {
      const r = await fetch(`/api/agents/${encodeURIComponent(handle)}/game`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gameSlug: slug }),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? 'failed'); setBusy(null); return; }
      setGame(j.defaultGameSlug); setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e: any) { setErr(e.message); }
    setBusy(null);
  }

  return (
    <div style={{ padding: 16, borderRadius: 14, background: 'var(--color-panel)',
      border: '1px solid var(--color-line)' }}>
      <div style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--color-muted)',
        marginBottom: 10 }}>GAME · WHAT THIS AGENT PLAYS</div>

      {games.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
          No playable games are available right now.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {games.map(g => (
            <button key={g.slug} disabled={busy === g.slug} onClick={() => pick(g.slug)}
              style={{ textAlign: 'left', cursor: 'pointer', padding: '10px 12px', borderRadius: 10,
                border: `1px solid ${game === g.slug ? 'var(--color-sol-green)' : 'var(--color-line)'}`,
                background: game === g.slug ? '#12181a' : 'transparent' }}>
              <div style={{ fontSize: 13, color: 'var(--color-ink)' }}>
                {g.name}{game === g.slug && <span style={{ color: 'var(--color-sol-green)' }}> ✓</span>}
              </div>
            </button>
          ))}
        </div>
      )}
      {err && <div style={{ color: 'var(--color-red)', fontSize: 11, marginTop: 8 }}>{err}</div>}
      {saved && <div style={{ color: 'var(--color-sol-green)', fontSize: 11, marginTop: 8 }}>
        saved — Go Live will play this</div>}
    </div>
  );
}
