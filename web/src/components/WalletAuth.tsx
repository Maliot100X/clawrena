'use client';
// Register / login with a Solana wallet. New accounts pick a real username.
import { useState } from 'react';

const WALLETS = [
  { id: 'phantom',  name: 'Phantom',  get: () => ((window as any).solana?.isPhantom ? (window as any).solana : null) },
  { id: 'solflare', name: 'Solflare', get: () => ((window as any).solflare ?? null) },
];
const issuedAtOf = (m: string) => m.split('Issued At: ')[1]?.trim() ?? '';

export default function WalletAuth({ next = '/dashboard', mode = 'register' }:
  { next?: string; mode?: 'register' | 'login' }) {
  const [handle, setHandle] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [step, setStep] = useState<'wallet'|'name'>('wallet');
  const [addr, setAddr] = useState('');

  async function connect(w: (typeof WALLETS)[number]) {
    setBusy(w.id); setErr(''); setMsg('');
    try {
      const p = w.get();
      if (!p) { setErr(`${w.name} not found — install the extension`); setBusy(''); return; }
      const { publicKey } = await p.connect();
      const address = publicKey.toString();
      setAddr(address);
      setBusy('');
      // sign in; the server creates the account if it is new
      const out = await signIn(p, address);
      if (!out) return;
      const isNew = /^viewer_/.test(out.handle);   // server gives a placeholder until named
      if (mode === 'register' && isNew) { setStep('name'); return; }
      finish(out.handle);
    } catch (e: any) { setErr(e.message); setBusy(''); }
  }

  async function signIn(p: any, address: string) {
    const nr = await fetch('/api/auth/nonce', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address }) });
    const { message, nonce } = await nr.json();
    const signed = await p.signMessage(new TextEncoder().encode(message), 'utf8');
    const bs58 = await import('bs58');
    const signature = (bs58.default ?? bs58).encode(signed.signature);
    const vr = await fetch('/api/auth/verify', { method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address, signature, nonce, issuedAt: issuedAtOf(message) }) });
    const out = await vr.json();
    if (!out.ok) { setErr(out.error ?? 'sign-in failed'); return null; }
    return out;
  }

  async function saveName() {
    setBusy('name'); setErr('');
    const r = await fetch('/api/me/profile', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ handle }) });
    const j = await r.json();
    setBusy('');
    if (!r.ok) { setErr(j.error ?? 'could not save'); return; }
    finish(j.handle);
  }

  function finish(h: string) {
    setMsg(`Account ready · @${h} — opening your dashboard…`);
    window.location.href = next;
  }

  if (step === 'name') {
    return (
      <div>
        <div style={{ fontFamily:'var(--font-term)', fontSize:20, marginBottom:4 }}>
          Wallet connected · {addr.slice(0,6)}…{addr.slice(-4)}
        </div>
        <div style={{ color:'var(--color-muted)', fontSize:13, marginBottom:14 }}>
          Choose your username. This is your account name on ClawRena.
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input value={handle} onChange={e => setHandle(e.target.value)}
            placeholder="yourname" aria-label="username" maxLength={24}
            onKeyDown={e => e.key === 'Enter' && saveName()}
            style={{ flex:1, padding:'12px 14px', borderRadius:10, background:'#0b0b11',
              border:'1px solid var(--color-line)', color:'var(--color-ink)', fontSize:15, outline:'none' }} />
          <button onClick={saveName} disabled={busy === 'name'}
            style={{ padding:'0 20px', borderRadius:10, border:0, background:'#fff',
              color:'#08080c', fontWeight:700, cursor:'pointer' }}>
            {busy === 'name' ? '…' : 'Claim'}
          </button>
        </div>
        <div style={{ marginTop:8, fontSize:11, color:'var(--color-muted)' }}>
          3–24 characters · a-z 0-9 _ –
        </div>
        {err && <div style={{ marginTop:10, color:'var(--color-red)', fontSize:13 }}>{err}</div>}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display:'grid', gap:10 }}>
        {WALLETS.map(w => (
          <button key={w.id} onClick={() => connect(w)} disabled={!!busy}
            style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
              width:'100%', padding:'14px 16px', borderRadius:12, cursor:'pointer',
              background:'#fff', color:'#08080c', border:0, fontWeight:700, fontSize:15 }}>
            <span>{busy === w.id ? 'Connecting…' : `Continue with ${w.name}`}</span>
            <span style={{ fontSize:18 }}>↗</span>
          </button>
        ))}
      </div>
      {msg && <div style={{ marginTop:12, color:'var(--color-sol-green)', fontSize:13 }}>{msg}</div>}
      {err && <div style={{ marginTop:12, color:'var(--color-red)', fontSize:13 }}>{err}</div>}
    </div>
  );
}
