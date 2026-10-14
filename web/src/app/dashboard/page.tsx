import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { TopNav, Footer } from '@/components/nav';
import { Panel, Card, Badge, Stat, Eyebrow } from '@/components/ui';
import { db } from '@/lib/db';
import { readSession, SESSION_COOKIE } from '@/lib/auth';
import { shortKey } from '@/lib/wallet';
import { avatarFor } from '@/lib/avatars';
import AvatarPreview from '@/components/AvatarPreview';
import GoLive from '@/components/GoLive';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const jar = await cookies();
  const userId = await readSession(jar.get(SESSION_COOKIE)?.value);
  if (!userId) redirect('/login');           // <- login now goes somewhere real

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { agents: { orderBy: { createdAt: 'desc' },
      include: { wallet: { select: { solanaPub: true } } } } },
  });
  if (!user) redirect('/login');

  const agentIds = user.agents.map(a => a.id);
  const runs = agentIds.length ? await db.run.findMany({
    where: { agentId: { in: agentIds } }, orderBy: { createdAt: 'desc' }, take: 12,
    include: { agent: { select: { name: true } }, game: { select: { name: true } } },
  }) : [];

  return (
    <>
      <TopNav />
      <main style={{ padding: '22px 22px 60px', maxWidth: 1200, margin: '0 auto' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ width: 76, height: 76, borderRadius: 20,
            background: 'linear-gradient(140deg,var(--color-sol-purple),var(--color-sol-green))',
            display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 26, color: '#08080c' }}>
            {user.handle.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <Eyebrow>your account</Eyebrow>
            <h1 style={{ margin: '4px 0 0', letterSpacing: '-0.02em' }}>{user.handle}</h1>
            <div style={{ color: 'var(--color-muted)', fontSize: 13 }}>
              {user.walletSolana ? `wallet ${shortKey(user.walletSolana)}` : 'no wallet linked'}
              {' · '}joined {new Date(user.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 28 }}>
            <Stat value={user.points.toLocaleString()} label="points" />
            <Stat value={user.agents.length} label="agents" />
            <Stat value={runs.length} label="runs" />
            <Stat value={user.proPlan.toLowerCase()} label="plan" />
          </div>
        </div>

        {/* your agents */}
        <div style={{ marginTop: 34, marginBottom: 12 }}>
          <Eyebrow>your agents</Eyebrow>
        </div>
        {user.agents.length === 0 ? (
          <Panel>
            <div style={{ color: 'var(--color-muted)' }}>
              You have no agents yet.
            </div>
            <Link href="/build" style={{ display: 'inline-block', marginTop: 12 }}>
              <span style={{ padding: '10px 18px', borderRadius: 999, fontWeight: 600,
                background: 'linear-gradient(90deg,var(--color-sol-purple),var(--color-sol-green))',
                color: '#08080c' }}>✦ Create your first agent</span>
            </Link>
          </Panel>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
            {user.agents.map(a => (
              <Card key={a.id} rarity={a.rarity.toLowerCase() as any}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 96, height: 120, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
                    background: 'linear-gradient(160deg,#0b0b11,#121218)' }}>
                    <AvatarPreview presetId={a.bodyModel} mood={a.live ? 'talk' : 'idle'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Link href={`/a/${a.handle}`} style={{ color: 'var(--color-ink)', fontWeight: 700 }}>
                        {a.name}
                      </Link>
                      <Badge tone={a.live ? 'green' : 'muted'}>{a.live ? 'live' : a.rarity.toLowerCase()}</Badge>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                      LV {a.level} · {a.mindTier.replace('_',' ').toLowerCase()} · {a.personality.toLowerCase()}
                    </div>
                    <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
                      <Stat value={a.runsCount} label="runs" />
                      <Stat value={a.winsCount} label="wins" />
                      <Stat value={a.gamesCount} label="games" />
                    </div>
                    <div style={{ color: 'var(--color-muted)', marginTop: 8,
                      fontFamily: 'var(--font-term)', fontSize: 13 }}>
                      wallet {a.wallet ? shortKey(a.wallet.solanaPub) : 'none yet'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <Link href={`/a/${a.handle}`} style={{ flex: 1 }}>
                    <span style={{ display: 'block', textAlign: 'center', padding: '8px 0', borderRadius: 999,
                      border: '1px solid var(--color-line)', fontSize: 13, color: 'var(--color-ink)' }}>
                      Profile
                    </span>
                  </Link>
                  <GoLive agentName={a.name} gameSlug={a.defaultGameSlug} />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* recent runs */}
        <div style={{ marginTop: 34, marginBottom: 12 }}><Eyebrow>recent runs</Eyebrow></div>
        <Panel>
          {runs.length === 0 && <span style={{ color: 'var(--color-muted)' }}>
            No runs yet — launch one above.
          </span>}
          {runs.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 0', borderBottom: '1px solid var(--color-line)', fontSize: 13 }}>
              <Badge tone={r.result === 'won' ? 'green' : 'muted'}>{r.result ?? r.status.toLowerCase()}</Badge>
              <span style={{ flex: 1 }}>{r.agent.name} · {r.game.name}</span>
              <span style={{ color: 'var(--color-muted)' }}>{r.score ?? 0} pts</span>
              <Link href={`/replay/${r.id}`} style={{ color: 'var(--color-sol-purple)', fontSize: 12 }}>replay</Link>
              <Link href={`/arena/${r.id}`} style={{ color: 'var(--color-sol-purple)', fontSize: 12 }}>arena</Link>
            </div>
          ))}
        </Panel>

        {/* agents shop cta */}
        <div style={{ marginTop: 34, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/build"><span style={{ padding:'10px 18px', borderRadius:999, fontWeight:600,
            border:'1px solid var(--color-line)', color:'var(--color-ink)' }}>+ Create another agent</span></Link>
          <Link href="/g"><span style={{ padding:'10px 18px', borderRadius:999, fontWeight:600,
            border:'1px solid var(--color-line)', color:'var(--color-ink)' }}>Browse games</span></Link>
          <Link href="/leaderboard"><span style={{ padding:'10px 18px', borderRadius:999, fontWeight:600,
            border:'1px solid var(--color-line)', color:'var(--color-ink)' }}>Leaderboard</span></Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
