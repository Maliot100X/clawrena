'use client';
// Deals — the earning surface. A user types intent, we show live AON offers,
// they click through a tracked aon.link. That click is what attribution needs.
import { useState } from 'react';

type Offer = {
  offer_id: string; offer_instance_id: string;
  offer_info: { title: string; description?: string; category?: { id: string };
                commercial?: { price?: { amount: string; currency: string } } };
  entity?: { name?: string; logo?: string };
  goals?: { pricing?: { model?: string; amount?: string; rate?: string } }[];
  action?: { name?: string; consumer_action?: string; payload?: { url?: string } };
  material?: { url: string; tag?: string }[];
};

export default function Deals() {
  const [q, setQ] = useState('');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [test, setTest] = useState(false);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true); setErr(''); setOffers([]);
    try {
      const r = await fetch('/api/aon/search', { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ intent: q }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? 'search failed'); setBusy(false); return; }
      setOffers(j.offers ?? []); setTest(!!j.is_test);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <main style={{ padding: '22px 22px 60px', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ letterSpacing: '-0.02em' }}>Deals</h1>
      <p style={{ color: 'var(--color-muted)', fontSize: 14, marginTop: 4 }}>
        Say what you are looking for — live offers come back with real prices and links.
      </p>

      <form onSubmit={search} style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="running shoes under $150"
          style={{ flex: 1, padding: '12px 16px', borderRadius: 12, fontSize: 15,
            background: 'var(--color-panel)', border: '1px solid var(--color-line)',
            color: 'var(--color-ink)' }} />
        <button type="submit" disabled={busy}
          style={{ padding: '0 24px', borderRadius: 12, border: 0, cursor: 'pointer',
            fontWeight: 700, background: 'linear-gradient(90deg,#9945ff,#39ff88)', color: '#08080c' }}>
          {busy ? 'searching…' : 'find'}
        </button>
      </form>

      {test && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-muted)' }}>
        sandbox data (non-billable)</div>}
      {err && <div style={{ marginTop: 12, color: 'var(--color-red)', fontSize: 13 }}>{err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))',
        gap: 14, marginTop: 22 }}>
        {offers.map(o => {
          const price = o.offer_info?.commercial?.price;
          const url = o.action?.payload?.url;
          const img = o.material?.[0]?.url;
          const model = o.goals?.[0]?.pricing?.model?.toUpperCase();
          return (
            <div key={o.offer_instance_id ?? o.offer_id}
              style={{ background: 'var(--color-panel)', border: '1px solid var(--color-line)',
                borderRadius: 'var(--radius-panel)', padding: 16, display: 'flex',
                flexDirection: 'column', gap: 10 }}>
              {img && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" width={72} height={72}
                  style={{ borderRadius: 10, objectFit: 'cover', background: '#000' }} />
              )}
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-ink)' }}>
                {o.offer_info?.title}
              </div>
              {o.entity?.name && (
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{o.entity.name}</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {price && <span style={{ fontFamily: 'var(--font-term)', fontSize: 20 }}>
                  {price.currency} {price.amount}</span>}
                {model && <span style={{ fontSize: 10, letterSpacing: '0.1em',
                  color: 'var(--color-sol-green)', border: '1px solid var(--color-line)',
                  borderRadius: 999, padding: '2px 8px' }}>{model}</span>}
              </div>
              {o.offer_info?.description && (
                <div style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                  {o.offer_info.description.slice(0, 140)}…
                </div>
              )}
              {url && (
                <a href={url} target="_blank" rel="noopener noreferrer sponsored"
                  style={{ marginTop: 'auto', textAlign: 'center', padding: '10px 0',
                    borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14,
                    background: '#fff', color: '#08080c' }}>
                  {o.action?.name ?? 'View deal'} →
                </a>
              )}
            </div>
          );
        })}
      </div>

      {!busy && !offers.length && (
        <div style={{ marginTop: 28, color: 'var(--color-muted)', fontSize: 13 }}>
          try: “laptop under $1500”, “wireless headphones”, “running shoes”
        </div>
      )}
    </main>
  );
}
