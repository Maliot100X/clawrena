'use client';
// Log in with a Solana wallet. Uses the wallet adapter (Phantom + Solflare via
// WalletProviders in the root layout) instead of raw window.solana, which is
// why the old button silently did nothing when the provider was absent.
import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

function extractIssuedAt(m: string) {
  return m.split('Issued At: ')[1]?.trim() ?? '';
}

export default function Login() {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [msg, setMsg] = useState('');

  async function start() {
    if (!connected) { setVisible(true); return; }
    setMsg('Sign the message to finish signing in…');
    try {
      if (!publicKey || !signMessage) { setMsg('Wallet cannot sign messages.'); return; }
      const address = publicKey.toBase58();
      const nr = await fetch('/api/auth/nonce', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const { message, nonce } = await nr.json();
      const signed = await signMessage(new TextEncoder().encode(message));
      const bs58 = await import('bs58');
      const signature = (bs58.default ?? bs58).encode(signed);
      const vr = await fetch('/api/auth/verify', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address, signature, nonce, issuedAt: extractIssuedAt(message) }),
      });
      const out = await vr.json();
      if (out.ok) { setMsg(`Signed in as ${out.handle} — opening your dashboard…`);
        window.location.href = '/dashboard'; return; }
      setMsg(`Error: ${out.error ?? 'verify failed'}`);
    } catch (e: any) { setMsg('Failed: ' + e.message); }
  }

  return (
    <main style={{ padding: 40 }}>
      <h1 style={{ letterSpacing: 2 }}>Log in</h1>
      <button onClick={start} style={{ padding: '10px 16px', borderRadius: 10,
        border: 0, background: '#fff', color: '#0a0a0f', cursor: 'pointer', fontWeight: 700 }}>
        {connected ? 'Sign in' : 'Connect a wallet'}
      </button>
      {connected && publicKey && (
        <p style={{ color: '#8b93a7', fontSize: 13, marginTop: 8 }}>
          connected: {publicKey.toBase58().slice(0,4)}…{publicKey.toBase58().slice(-4)}
          {' · '}<a href="#" onClick={e=>{e.preventDefault();disconnect();}} style={{color:'#9945ff'}}>disconnect</a>
        </p>
      )}
      <p style={{ color: '#6fe3b4', minHeight: 20 }}>{msg}</p>
      <p><a href="/" style={{ color: '#9945ff' }}>← back</a></p>
    </main>
  );
}
