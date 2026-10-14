'use client';
// Pick a game -> Go Live. One press, agent is instantly in the arena playing it.
// No wizard, no second step.
import { useState } from 'react';
import { PLAYABLE } from '@/lib/games';

export default function GoLive({ agentName, defaultGame }:
  { agentName: string; defaultGame?: string | null }) {
  const [game, setGame] = useState(defaultGame && PLAYABLE.some(g=>g.slug===defaultGame)
    ? defaultGame : PLAYABLE[0].slug);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function go() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/arena/launch', { method:'POST',
        headers:{ 'content-type':'application/json' },
        body: JSON.stringify({ agentName, gameSlug: game, targetLevel: 12 }) });
      const j = await r.json();
      if (j.arenaUrl) { window.location.href = j.arenaUrl; return; }
      setErr(j.error ?? 'could not go live');
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  const chosen = PLAYABLE.find(g => g.slug === game)!;

  return (
    <div style={{ position:'relative', flex: 1 }}>
      <button onClick={() => { setOpen(o => !o); }} disabled={busy}
        style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          width:'100%', padding:'8px 0', borderRadius:999, border:0, cursor:'pointer',
          background:'linear-gradient(90deg,var(--color-sol-purple),var(--color-sol-green))',
          color:'#08080c', fontWeight:700, fontSize:13 }}>
        {busy ? 'Going live…' : '● Go Live'}
      </button>

      {open && (
        <div style={{ position:'absolute', bottom:'calc(100% + 8px)', right:0, zIndex:30,
          width:260, padding:10, borderRadius:14, background:'#0e0e14',
          border:'1px solid var(--color-line)', boxShadow:'0 12px 40px -12px #000' }}>
          <div style={{ fontSize:10, letterSpacing:'0.16em', color:'var(--color-muted)',
            marginBottom:8 }}>PLAY ON WHICH GAME?</div>
          {PLAYABLE.map(g => (
            <div key={g.slug} onClick={() => setGame(g.slug)}
              style={{ cursor:'pointer', padding:'9px 10px', borderRadius:10, marginBottom:6,
                border:`1px solid ${game===g.slug?'var(--color-sol-purple)':'var(--color-line)'}`,
                background: game===g.slug ? '#14141c' : 'transparent' }}>
              <div style={{ fontSize:13, color: game===g.slug?'var(--color-ink)':'var(--color-muted)' }}>
                {g.name}{!g.ready && <span style={{ opacity:.5 }}> · coming soon</span>}
              </div>
              <div style={{ fontSize:11, color:'var(--color-muted)' }}>{g.blurb}</div>
            </div>
          ))}
          <button onClick={go} disabled={busy || !chosen.ready}
            style={{ width:'100%', padding:'10px 0', borderRadius:10, border:0, marginTop:4,
              cursor: chosen.ready ? 'pointer' : 'not-allowed',
              background: chosen.ready ? '#fff' : '#22222c',
              color: chosen.ready ? '#08080c' : '#8b8598', fontWeight:700 }}>
            {busy ? 'Starting…' : `Go live on ${chosen.name}`}
          </button>
          {err && <div style={{ color:'var(--color-red)', fontSize:11, marginTop:6 }}>{err}</div>}
        </div>
      )}
    </div>
  );
}
