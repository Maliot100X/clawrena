'use client';
import { useState } from 'react';

function extractIssuedAt(m: string) {
  return m.split('Issued At: ')[1]?.trim() ?? '';
}

export default function Login() {
  const [msg, setMsg] = useState('');

  async function connect() {
    const sol = (window as any).solana;
    if (!sol) { setMsg('No Solana wallet found — install Phantom.'); return; }
    try {
      const { publicKey } = await sol.connect();
      const address = publicKey.toString();
      const nr = await fetch('/api/auth/nonce', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const { message, nonce } = await nr.json();
      const signed = await sol.signMessage(new TextEncoder().encode(message), 'utf8');
      const bs58 = await import('bs58');
      const signature = (bs58.default ?? bs58).encode(signed.signature);
      const vr = await fetch('/api/auth/verify', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address, signature, nonce, issuedAt: extractIssuedAt(message) }),
      });
      const out = await vr.json();
      if (out.ok) {
        setMsg(`Signed in as ${out.handle} — opening your dashboard…`);
        window.location.href = '/dashboard';   // full profile, not a text line
        return;
      }
      setMsg(`Error: ${out.error}`);
    } catch (e: any) { setMsg('Failed: ' + e.message); }
  }

  return (
    <main style={{ padding: 40 }}>
      <h1 style={{ letterSpacing: 2 }}>Log in</h1>
      <button onClick={connect} style={{ padding: '10px 16px', borderRadius: 10,
        border: 0, background: '#fff', color: '#0a0a0f', cursor: 'pointer' }}>
        Connect Phantom
      </button>
      <p style={{ color: '#6fe3b4', minHeight: 20 }}>{msg}</p>
      <p><a href="/" style={{ color: '#9945ff' }}>← back</a></p>
    </main>
  );
}
