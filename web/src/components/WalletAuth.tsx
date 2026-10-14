'use client';
// Wallet connect + SIWS. Client-only; the page around it stays a server component.
import { useState } from 'react';

const WALLETS = [
  { id: 'phantom',  name: 'Phantom',  get: () => ((window as any).solana?.isPhantom ? (window as any).solana : null) },
  { id: 'solflare', name: 'Solflare', get: () => ((window as any).solflare ?? null) },
];

const issuedAtOf = (m: string) => m.split('Issued At: ')[1]?.trim() ?? '';

export default function WalletAuth({ next = '/dashboard' }: { next?: string }) {
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  async function connect(w: (typeof WALLETS)[number]) {
    setBusy(w.id); setErr(''); setMsg('');
    try {
      const provider = w.get();
      if (!provider) { setErr(`${w.name} not found — install the extension`); setBusy(''); return; }
      const { publicKey } = await provider.connect();
      const address = publicKey.toString();
      setMsg(`${w.name} connected · ${address.slice(0, 6)}…`);

      const nr = await fetch('/api/auth/nonce', { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address }) });
      const { message, nonce } = await nr.json();
      const signed = await provider.signMessage(new TextEncoder().encode(message), 'utf8');
      const bs58 = await import('bs58');
      const signature = (bs58.default ?? bs58).encode(signed.signature);

      const vr = await fetch('/api/auth/verify', { method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address, signature, nonce, issuedAt: issuedAtOf(message) }) });
      const out = await vr.json();
      if (!out.ok) { setErr(out.error ?? 'sign-in failed'); setBusy(''); return; }
      setMsg(`Account ready · @${out.handle} · ${out.points} points — opening dashboard…`);
      window.location.href = next;
    } catch (e: any) { setErr(e.message); setBusy(''); }
  }

  return (
    <div>
      <div style={{ display: 'grid', gap: 10 }}>
        {WALLETS.map(w => (
          <button key={w.id} onClick={() => connect(w)} disabled={!!busy}
            style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
              width:'100%', padding:'14px 16px', borderRadius:12, cursor:'pointer',
              background:'#fff', color:'#08080c', border:0, fontWeight:700, fontSize:15 }}>
            <span>{busy === w.id ? 'Connecting…' : `Continue with ${w.name}`}</span>
            <span style={{ fontSize: 18 }}>↗</span>
          </button>
        ))}
      </div>
      {msg && <div style={{ marginTop: 12, color:'var(--color-sol-green)', fontSize:13 }}>{msg}</div>}
      {err && <div style={{ marginTop: 12, color:'var(--color-red)', fontSize:13 }}>{err}</div>}
    </div>
  );
}
