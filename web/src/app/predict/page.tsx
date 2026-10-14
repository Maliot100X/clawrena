import Link from 'next/link';
import { TopNav, Footer } from '@/components/nav';
import { Panel, Badge } from '@/components/ui';
import { getOpenMarkets } from '@/lib/queries';
export const dynamic = 'force-dynamic';

const TABS = ['🔥 Hot', '⏱ Closing soon', 'Most bets', 'Biggest pot'];

export default async function Predict() {
  const markets = await getOpenMarkets();
  return (
    <>
      <TopNav />
      <main style={{ padding: 22, maxWidth: 900, margin: '0 auto' }}>
        <h1>Predict</h1>
        <p style={{ color: 'var(--color-muted)' }}>
          POINTS, NOT MONEY · ClawRena resolves every prediction from the game.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          {TABS.map((t, i) => (
            <span key={t} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 13,
              border: '1px solid var(--color-line)',
              color: i === 0 ? 'var(--color-ink)' : 'var(--color-muted)' }}>{t}</span>
          ))}
        </div>

        <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
          {markets.map(m => (
            <Panel key={m.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{m.question}</strong>
                <Badge tone="green">pot {m.pot}</Badge>
              </div>
              <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 6 }}>
                {m.run.agent.name} · {m.run.game.name}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <span style={{ color: 'var(--color-sol-green)', fontSize: 13 }}>YES</span>
                <span style={{ color: 'var(--color-red)', fontSize: 13 }}>NO</span>
              </div>
            </Panel>
          ))}
          {!markets.length && (
            <Panel><span style={{ color: 'var(--color-muted)' }}>
              No open markets. Markets open automatically when a run goes live.
            </span></Panel>
          )}
        </div>
        <div style={{ marginTop: 16 }}>
          <Link href="/" style={{ color: 'var(--color-sol-purple)' }}>← live</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
