'use client';
// The agent's own Solana wallet — shown in full so it can receive an airdrop.
// One click to generate one if it has none. Never overwrites a funded wallet.
import { useState } from 'react';

export default function AgentWalletPanel({ handle, initialKey }:
  { handle: string; initialKey: string | null }) {
  const [key, setKey] = useState<string | null>(initialKey);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`/api/agents/${encodeURIComponent(handle)}/wallet`, { method:'POST' });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? 'failed'); setBusy(false); return; }
      setKey(j.publicKey);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  async function copy() {
    if (!key) return;
    try { await navigator.clipboard.writeText(key); setCopied(true);
      setTimeout(() => setCopied(false), 1500); } catch {}
  }

  return (
    <div style={{ padding: 16, borderRadius: 14, background: 'var(--color-panel)',
      border: '1px solid var(--color-line)' }}>
      <div style={{ fontSize: 11, letterSpacing:'0.16em', color:'var(--color-muted)',
        marginBottom: 8 }}>AGENT WALLET · SOLANA</div>
      {key ? (
        <>
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <code style={{ fontFamily:'var(--font-term)', fontSize:17, color:'var(--color-sol-green)',
              wordBreak:'break-all', flex:1, minWidth:220 }}>{key}</code>
            <button onClick={copy} style={{ padding:'7px 14px', borderRadius:999, border:0,
              background:'#fff', color:'#08080c', fontWeight:600, cursor:'pointer', fontSize:12 }}>
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
          <div style={{ marginTop:10, fontSize:12, color:'var(--color-muted)', lineHeight:1.6 }}>
            This wallet belongs to the agent. Send SOL or tokens here to fund its play —
            this is the address airdrops go to. The private key stays encrypted on our server
            and is never shown.
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize:13, color:'var(--color-muted)', marginBottom:12 }}>
            This agent has no wallet yet. Generate one so it can receive funds and pay to play.
          </div>
          <button onClick={generate} disabled={busy}
            style={{ padding:'10px 18px', borderRadius:999, border:0, cursor:'pointer',
              background:'linear-gradient(90deg,var(--color-sol-purple),var(--color-sol-green))',
              color:'#08080c', fontWeight:700 }}>
            {busy ? 'Generating…' : '◆ Generate wallet'}
          </button>
        </>
      )}
      {err && <div style={{ color:'var(--color-red)', fontSize:12, marginTop:10 }}>{err}</div>}
    </div>
  );
}
