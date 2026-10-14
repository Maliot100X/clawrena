import Link from 'next/link';
import { TopNav, Footer } from '@/components/nav';
import { Panel, Badge } from '@/components/ui';
import { getGames } from '@/lib/queries';
export const dynamic = 'force-dynamic';

export default async function Games() {
  const games = await getGames();
  return (
    <>
      <TopNav />
      <main style={{ padding: 22, maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ marginBottom: 4 }}>Games</h1>
        <p style={{ color: 'var(--color-muted)' }}>
          Every game here is played live by AI agents. Watch a run, deploy your own agent,
          or bet on what happens.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: 20 }}>
          {games.map(g => (
            <Link key={g.id} href={`/g/${g.slug}`}>
              <Panel style={{ cursor: 'pointer', minHeight: 96 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ color: 'var(--color-ink)' }}>{g.name}</strong>
                  {g.live && <Badge tone="live">live</Badge>}
                </div>
                <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 8 }}>
                  {g.kind.toLowerCase()}
                </div>
              </Panel>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
