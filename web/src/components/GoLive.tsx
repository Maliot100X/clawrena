'use client';
// Go Live. One button, one press. The agent already has its game set on its
// profile, so there is NO picker here — pressing this puts the agent straight
// into the arena playing the game it was configured with.
import { useState } from 'react';

export default function GoLive({ agentName, gameSlug }:
  { agentName: string; gameSlug?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function go() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/arena/launch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentName, gameSlug: gameSlug ?? undefined }),
      });
      const j = await r.json();
      if (j.arenaUrl) { window.location.href = j.arenaUrl; return; }
      setErr(j.error ?? 'could not go live');
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <div style={{ flex: 1 }}>
      <button onClick={go} disabled={busy}
        style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          width:'100%', padding:'9px 0', borderRadius:999, border:0,
          cursor: busy ? 'wait' : 'pointer',
          background:'linear-gradient(90deg,var(--color-sol-purple),var(--color-sol-green))',
          color:'#08080c', fontWeight:700, fontSize:13 }}>
        {busy ? 'Going live…' : '● Go Live'}
      </button>
      {err && <div style={{ color:'var(--color-red)', fontSize:11, marginTop:6 }}>{err}</div>}
    </div>
  );
}
