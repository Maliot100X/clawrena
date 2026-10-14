'use client';
// Mind tab — how it plays + how well it thinks, with a REAL brain test:
// asks the configured provider what the agent would do, live.
import { useState } from 'react';

const PLAY = [
  { id:'STRATEGIST', label:'Strategist', desc:'Patient. Sets up, then strikes.' },
  { id:'DAREDEVIL',  label:'Daredevil',  desc:'Impulsive, direct, and fearless. Acts fast and comments with energy.' },
  { id:'COMEDIAN',   label:'Comedian',   desc:'Plays for the moment. Everything is a bit.' },
  { id:'CAUTIOUS',   label:'Cautious',   desc:'Protects the run. Avoids the horde.' },
  { id:'CUSTOM',     label:'Custom',     desc:'Write the personality yourself.' },
];
const MIND = [
  { id:'ORC',         label:'Orc',         desc:'fast and cheap — blunders freely' },
  { id:'HUMAN',       label:'Human',       desc:'Plays well, blunders like anyone. The default.' },
  { id:'WIZARD',      label:'Wizard',      desc:'deeper reasoning' },
  { id:'HIGH_WIZARD', label:'High Wizard', desc:'deepest available' },
];

export default function MindTab({ mind, setMind, pers, setPers, custom, setCustom, agentName }:
  { mind: string; setMind: (m: string)=>void; pers: string; setPers: (p: string)=>void;
    custom: string; setCustom: (c: string)=>void; agentName?: string }) {
  const [thought, setThought] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [provider, setProvider] = useState('');

  async function testBrain() {
    setBusy(true); setErr(''); setThought('');
    try {
      const r = await fetch('/api/brain/test', { method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ agentName: agentName || 'your agent', mindTier: mind,
          personality: pers, customMind: custom }) });
      const j = await r.json();
      if (!r.ok || j.error) { setErr(j.error === 'arena unreachable'
        ? 'brain server offline — start the arena to test' : (j.error ?? 'failed')); }
      else { setThought(j.say ?? ''); setProvider(j.provider ?? ''); }
    } catch (e:any) { setErr(e.message); }
    setBusy(false);
  }

  const lbl: any = { color:'var(--color-muted)', fontSize:11, letterSpacing:'0.16em', marginBottom:6 };

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Mind</h3>

      <div style={lbl}>HOW IT PLAYS</div>
      <div style={{ display:'grid', gap:6, marginBottom:18 }}>
        {PLAY.map(p => (
          <div key={p.id} onClick={()=>setPers(p.id)} style={{ cursor:'pointer',
            padding:'9px 12px', borderRadius:10,
            border:`1px solid ${pers===p.id?'var(--color-sol-green)':'var(--color-line)'}`,
            background: pers===p.id ? '#14141c' : 'transparent' }}>
            <div style={{ fontSize:13, color: pers===p.id?'var(--color-ink)':'var(--color-muted)' }}>{p.label}</div>
            <div style={{ fontSize:11, color:'var(--color-muted)' }}>{p.desc}</div>
          </div>
        ))}
      </div>
      {pers === 'CUSTOM' && (
        <textarea value={custom} onChange={e=>setCustom(e.target.value)}
          placeholder="Describe how your agent thinks and talks…" rows={3}
          style={{ width:'100%', marginBottom:18, padding:10, borderRadius:10,
            background:'#0b0b11', border:'1px solid var(--color-line)',
            color:'var(--color-ink)', fontSize:13, resize:'vertical' }} />
      )}

      <div style={lbl}>HOW WELL IT THINKS</div>
      <div style={{ display:'grid', gap:6, marginBottom:16 }}>
        {MIND.map(m => (
          <div key={m.id} onClick={()=>setMind(m.id)} style={{ cursor:'pointer',
            padding:'9px 12px', borderRadius:10,
            border:`1px solid ${mind===m.id?'var(--color-sol-purple)':'var(--color-line)'}`,
            background: mind===m.id ? '#14141c' : 'transparent' }}>
            <div style={{ fontSize:13, color: mind===m.id?'var(--color-ink)':'var(--color-muted)' }}>{m.label}</div>
            <div style={{ fontSize:11, color:'var(--color-muted)' }}>{m.desc}</div>
          </div>
        ))}
      </div>

      {/* the live brain test */}
      <button onClick={testBrain} disabled={busy}
        style={{ padding:'10px 18px', borderRadius:999, border:0, cursor:'pointer',
          background:'#fff', color:'#08080c', fontWeight:600 }}>
        {busy ? 'Thinking…' : '▶ Test the brain'}
      </button>

      {(thought || busy) && (
        <div style={{ marginTop:12, padding:14, borderRadius:12,
          border:'1px solid var(--color-line)', background:'#0b0b11' }}>
          <div style={{ fontSize:11, letterSpacing:'0.16em', color:'var(--color-muted)', marginBottom:6 }}>
            {(agentName || 'YOUR AGENT').toUpperCase()} IS {busy ? 'THINKING' : 'SAYING'}
            {provider && <span style={{ color:'var(--color-sol-purple)' }}> · {provider}</span>}
          </div>
          <div style={{ fontFamily:'var(--font-term)', fontSize:18, color:'var(--color-ink)' }}>
            {busy ? '…' : `“${thought}”`}
          </div>
        </div>
      )}
      {err && <div style={{ color:'var(--color-red)', fontSize:12, marginTop:8 }}>{err}</div>}
    </div>
  );
}
