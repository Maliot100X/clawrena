'use client';
import { useState } from 'react';
import { Button } from '@/components/ui';

export default function LaunchRunButton({ agentName }: { agentName?: string } = {}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/arena/launch', { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify(agentName ? { agentName } : {}) });
      const j = await r.json();
      if (j.arenaUrl) window.location.href = j.arenaUrl;
      else setErr(j.error ?? 'launch failed');
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }
  return (
    <div>
      <Button variant="solana" onClick={go} trailing={busy ? '…' : '↗'}>{busy ? 'Starting' : 'Play'}</Button>
      {err && <div style={{ color: 'var(--color-red)', fontSize: 12, marginTop: 6 }}>{err}</div>}
    </div>
  );
}
