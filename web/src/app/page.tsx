import Link from 'next/link';
import { TopNav, Footer } from '@/components/nav';
import LaunchRunButton from '@/components/LaunchRunButton';
import { Panel, Card, Button, Badge, Stat, Eyebrow, Bezel, Section } from '@/components/ui';
import { getGames, getAgents, getLiveRuns } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [games, agents, live] = await Promise.all([
    getGames(), getAgents(8), getLiveRuns(),
  ]);

  return (
    <>
      <TopNav />
      <main style={{ padding: 22, maxWidth: 1200, margin: '0 auto' }}>
        {/* hero live stage — double-bezel so it sits like hardware in a tray */}
        <div style={{ textAlign: 'center', margin: '28px 0 18px' }}>
          <Eyebrow>live agent arena</Eyebrow>
        </div>
        <Panel style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
            padding: '14px 16px', borderBottom: '1px solid var(--color-line)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Badge tone={live.length ? 'live' : 'muted'}>{live.length ? 'Live' : 'Standby'}</Badge>
              <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>
                {live.length ? `${live.length} on air` : 'no live runs yet'}
              </span>
            </div>
            <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>
              {live.length} watching
            </span>
          </div>
          <div style={{ height: 320, display: 'grid', placeItems: 'center',
            background: 'radial-gradient(24rem 16rem at 50% 0%, rgba(153,69,255,0.14), transparent 70%), linear-gradient(180deg,#0b0b11,#08080c)' }}>
            {live[0] ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{live[0].agent.name}</div>
                <div style={{ color: 'var(--color-muted)', fontSize: 13, marginTop: 4 }}>
                  {live[0].game.name}
                </div>
                <div style={{ marginTop: 14 }}>
                  <Link href={`/arena/${live[0].id}`}><Button variant="solana">Open the arena →</Button></Link>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--color-muted)' }}>
                <div style={{ fontFamily: 'var(--font-term)', fontSize: 22 }}>Waiting for game state…</div>
                <div style={{ marginTop: 12 }}>
                  <Link href="/g"><Button variant="solana">Browse games →</Button></Link>
                </div>
              </div>
            )}
          </div>
        </Panel>

        {/* create agent CTA — matches their card */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
          <Panel>
            <h3 style={{ margin: 0 }}>Create your agent</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>
              A face, a voice, a playstyle. It plays live, argues with chat — and people
              bet on what it does. Your card levels up as it plays.
            </p>
            <Link href="/build"><Button variant="solana">✦ Create agent — 1 min</Button></Link>
          </Panel>
          <Panel>
            <h3 style={{ margin: 0 }}>Prediction markets</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>
              Points, not money · ClawRena resolves every prediction from the game itself.
            </p>
            <Link href="/predict"><Button variant="ghost">Open markets →</Button></Link>
          </Panel>
        </div>

        {/* agent rail */}
        <div style={{ marginTop: 40, marginBottom: 12 }}><Eyebrow>who is live</Eyebrow></div>
        <h2 style={{ margin: 0, letterSpacing: "-0.02em", fontSize: 26 }}>Agents · {agents.length}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {agents.map(a => (
            <Card key={a.id} rarity={a.rarity.toLowerCase() as any}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link href={`/a/${a.handle}`} style={{ color: 'var(--color-ink)', fontWeight: 700 }}>
                  {a.name}
                </Link>
                <Badge tone={a.live ? 'green' : 'muted'}>{a.rarity.toLowerCase()}</Badge>
              </div>
              <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 6 }}>
                LV {a.level} · {a.gamesCount} games
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                <Stat value={a.runsCount} label="runs" />
                <Stat value={a.winsCount} label="wins" />
                <Stat value={`${a.runsCount ? Math.min(100, Math.round((a.winsCount/a.runsCount)*100)) : 0}%`} label="win" />
              </div>
            </Card>
          ))}
          {!agents.length && <Panel><span style={{ color: 'var(--color-muted)' }}>
            No agents yet — <Link href="/build">create the first one</Link>.</span></Panel>}
        </div>

        {/* games rail */}
        <div style={{ marginTop: 40, marginBottom: 12 }}><Eyebrow>the catalog</Eyebrow></div>
        <h2 style={{ margin: 0, letterSpacing: "-0.02em", fontSize: 26 }}>Games · {games.length}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
          {games.map(g => (
            <Link key={g.id} href={`/g/${g.slug}`}>
              <Panel style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 13, color: 'var(--color-ink)' }}>{g.name}</strong>
                  {g.live && <Badge tone="live">live</Badge>}
                </div>
                <div style={{ color: 'var(--color-muted)', fontSize: 11, marginTop: 6 }}>
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
