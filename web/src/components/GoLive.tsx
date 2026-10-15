'use client';
// Go Live — pick a game, press once, the agent goes live on it.
// The picker shows only games an agent can actually play (NATIVE, real engines).
import { useState, useEffect } from 'react';

type Game = { slug: string; name: string; ready: boolean };

export default function GoLive({ agentName, gameSlug }:
  { agentName: string; gameSlug?: string | null }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [picked, setPicked] = useState<string | null>(gameSlug ?? null);

  // load the real games the agent can play
  useEffect(() => {
    if (!open || games.length) return;
    fetch('/api/games/playable')
      .then(r => r.json())
      .then(j => setGames(j.games ?? []))
      .catch(() => {});
  }, [open, games.length]);

  async function go(slug?: string | null) {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/arena/launch', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentName, gameSlug: slug ?? picked ?? undefined }),
      });
      const j = await r.json();
      if (j.arenaUrl) { window.location.href = j.arenaUrl; return; }
      setErr(j.error ?? 'could not go live');
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <button onClick={() => setOpen(o => !o)} disabled={busy}
        style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          width:'100%', padding:'9px 0', borderRadius:999, border:0, cursor:'pointer',
          background:'linear-gradient(90deg,var(--color-sol-purple),var(--color-sol-green))',
          color:'#08080c', fontWeight:700, fontSize:13 }}>
        {busy ? 'Going live…' : '● Go Live'}
      </button>

      {open && (
        <div style={{ position:'absolute', bottom:'calc(100% + 8px)', left:0, zIndex:40,
          width:280, padding:12, borderRadius:14, background:'#0e0e16',
          border:'1px solid var(--color-line)', boxShadow:'0 12px 40px -12px #000' }}>
          <div style={{ fontSize:10, letterSpacing:'0.16em', color:'var(--color-muted)',
            marginBottom:8 }}>PLAY WHICH GAME?</div>
          {games.length === 0 && (
            <div style={{ fontSize:12, color:'var(--color-muted)', padding:'6px 0' }}>loading…</div>
          )}
          {games.map(g => (
            <button key={g.slug} onClick={() => go(g.slug)} disabled={busy}
              style={{ display:'block', width:'100%', textAlign:'left', marginBottom:6,
                padding:'10px 12px', borderRadius:10, cursor:'pointer',
                border:'1px solid '+(picked===g.slug?'var(--color-sol-green)':'var(--color-line)'),
                background: picked===g.slug ? '#12181a' : 'transparent' }}>
              <div style={{ fontSize:13, color:'var(--color-ink)' }}>{g.name}</div>
              <div style={{ fontSize:11, color:'var(--color-sol-green)' }}>▶ go live on {g.name}</div>
            </button>
          ))}
          {err && <div style={{ color:'var(--color-red)', fontSize:11, marginTop:6 }}>{err}</div>}
        </div>
      )}
    </div>
  );
}
