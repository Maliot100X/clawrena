'use client';
// Floating site assistant. A launcher bubble bottom-right opens a chat panel.
// When the user asks about a product it answers AND attaches real AON offers
// with tracked links, so the same conversation monetises twice.
import { useState, useRef, useEffect } from 'react';

type Offer = { title: string; price: string | null; merchant: string | null;
               image: string | null; url: string | null; cta: string };
type Turn = { who: 'you' | 'ai'; text: string; offers?: Offer[] };

export default function Assistant() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([
    { who: 'ai', text: 'Hi — I can help you create an agent, go live, or find deals. What do you need?' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, open]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setInput('');
    const next: Turn[] = [...turns, { who: 'you', text: msg }];
    setTurns(next); setBusy(true);
    try {
      const r = await fetch('/api/assistant', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next.map(t => ({
          role: t.who === 'you' ? 'user' : 'assistant', content: t.text })) }),
      });
      const j = await r.json();
      setTurns(t => [...t, { who: 'ai', text: j.reply ?? '…', offers: j.offers ?? [] }]);
    } catch {
      setTurns(t => [...t, { who: 'ai', text: 'Something went wrong — try again.' }]);
    }
    setBusy(false);
  }

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Open assistant"
          style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 60, width: 56, height: 56,
            borderRadius: 999, border: 0, cursor: 'pointer', fontSize: 24,
            background: 'linear-gradient(135deg,#9945ff,#39ff88)', color: '#08080c',
            boxShadow: '0 10px 30px -8px rgba(153,69,255,.7)' }}>✦</button>
      )}

      {open && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 60, width: 360,
          maxWidth: 'calc(100vw - 40px)', height: 520, maxHeight: 'calc(100vh - 40px)',
          display: 'flex', flexDirection: 'column', borderRadius: 18, overflow: 'hidden',
          background: '#0c0c12', border: '1px solid var(--color-line)',
          boxShadow: '0 24px 60px -16px #000' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderBottom: '1px solid var(--color-line)' }}>
            <div style={{ fontWeight: 700, letterSpacing: 1 }}>✦ CLAWRENA ASSISTANT</div>
            <button onClick={() => setOpen(false)} aria-label="Close"
              style={{ background: 'transparent', border: 0, color: 'var(--color-muted)',
                fontSize: 18, cursor: 'pointer' }}>×</button>
          </div>

          <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: 14,
            display: 'flex', flexDirection: 'column', gap: 10 }}>
            {turns.map((t, i) => (
              <div key={i} style={{ alignSelf: t.who === 'you' ? 'flex-end' : 'flex-start',
                maxWidth: '88%' }}>
                <div style={{ padding: '9px 12px', borderRadius: 12, fontSize: 13.5,
                  lineHeight: 1.5, background: t.who === 'you' ? '#1b2136' : '#15151d',
                  border: '1px solid var(--color-line)', color: 'var(--color-ink)' }}>
                  {t.text}
                </div>
                {!!t.offers?.length && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {t.offers.map((o, k) => (
                      <a key={k} href={o.url ?? '#'} target="_blank" rel="noopener noreferrer sponsored"
                        style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 8,
                          borderRadius: 10, textDecoration: 'none', background: '#101018',
                          border: '1px solid var(--color-line)' }}>
                        {o.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={o.image} alt="" width={40} height={40}
                            style={{ borderRadius: 8, objectFit: 'cover', background: '#000' }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, color: 'var(--color-ink)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {o.title}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                            {o.merchant}{o.price ? ` · ${o.price}` : ''}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--color-sol-green)' }}>→</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>thinking…</div>}
          </div>

          <div style={{ display: 'flex', gap: 8, padding: 12,
            borderTop: '1px solid var(--color-line)' }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(); }}
              placeholder="Ask, or search for a deal…"
              style={{ flex: 1, padding: '10px 12px', borderRadius: 10, fontSize: 13,
                background: '#101018', border: '1px solid var(--color-line)',
                color: 'var(--color-ink)' }} />
            <button onClick={() => send()} disabled={busy}
              style={{ padding: '0 16px', borderRadius: 10, border: 0, cursor: 'pointer',
                fontWeight: 700, background: 'linear-gradient(90deg,#9945ff,#39ff88)',
                color: '#08080c' }}>↑</button>
          </div>
        </div>
      )}
    </>
  );
}
