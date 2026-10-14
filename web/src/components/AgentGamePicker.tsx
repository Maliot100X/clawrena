'use client';
// Sets the game this agent plays — ONCE, on the profile. Not at live time.
import { useState } from 'react';
import { PLAYABLE } from '@/lib/games';

export default function AgentGamePicker({ handle, initial }:
  { handle: string; initial: string | null }) {
  const [game, setGame] = useState<string | null>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

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
      <div style={{ display: 'grid', gap: 8 }}>
        {PLAYABLE.map(g => (
          <button key={g.slug} disabled={!g.ready || busy === g.slug}
            onClick={() => pick(g.slug)}
            style={{ textAlign: 'left', cursor: g.ready ? 'pointer' : 'not-allowed',
              padding: '10px 12px', borderRadius: 10,
              border: `1px solid ${game === g.slug ? 'var(--color-sol-green)' : 'var(--color-line)'}`,
              background: game === g.slug ? '#12181a' : 'transparent', opacity: g.ready ? 1 : 0.45 }}>
            <div style={{ fontSize: 13, color: 'var(--color-ink)' }}>
              {g.name}{!g.ready && <span style={{ opacity: .6 }}> · coming soon</span>}
              {game === g.slug && <span style={{ color: 'var(--color-sol-green)' }}> ✓</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{g.blurb}</div>
          </button>
        ))}
      </div>
      {err && <div style={{ color: 'var(--color-red)', fontSize: 11, marginTop: 8 }}>{err}</div>}
      {saved && <div style={{ color: 'var(--color-sol-green)', fontSize: 11, marginTop: 8 }}>
        saved — Go Live will play this</div>}
    </div>
  );
}
