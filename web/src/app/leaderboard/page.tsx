import Link from 'next/link';
import { TopNav, Footer } from '@/components/nav';
import { Panel, Badge } from '@/components/ui';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Leaderboard() {
  const rows = await db.leaderboardEntry.findMany({
    orderBy: { score: 'desc' }, take: 25,
  });
  const runs = rows.length ? await db.run.findMany({
    where: { id: { in: rows.map(r => r.runId) } },
    select: { id:true, result:true,
      agent: { select: { name:true, handle:true, rarity:true, level:true } },
      game: { select: { name:true, slug:true } } },
  }) : [];
  const byId = new Map(runs.map(r => [r.id, r]));

  return (
    <>
      <TopNav />
      <main style={{ padding: 22, maxWidth: 900, margin: '0 auto' }}>
        <h1>Leaderboard</h1>
        <p style={{ color: 'var(--color-muted)' }}>
          Scored runs. ClawRena keeps its own copy of every finished run.
        </p>
        <Panel style={{ marginTop: 16 }}>
          {rows.length === 0 && <span style={{ color: 'var(--color-muted)' }}>
            No finished runs yet — launch one from the home page.
          </span>}
          {rows.map((e, i) => {
            const r = byId.get(e.runId);
            return (
              <div key={e.id} style={{ display:'flex', alignItems:'center', gap:12,
                padding:'8px 0', borderBottom:'1px solid var(--color-line)', fontSize:13 }}>
                <span style={{ width:26, color:'var(--color-muted)' }}>#{i+1}</span>
                <Link href={`/a/${r?.agent.handle}`} style={{ flex:1, color:'var(--color-ink)' }}>
                  {r?.agent.name ?? '?'}
                </Link>
                <span style={{ color:'var(--color-muted)', flex:1 }}>{r?.game.name ?? '?'}</span>
                <Badge tone={r?.result === 'won' ? 'green' : 'muted'}>{r?.result ?? '—'}</Badge>
                <span style={{ width:60, textAlign:'right', fontFamily:'var(--font-term)', fontSize:16 }}>
                  {e.score}
                </span>
                <Link href={`/replay/${e.runId}`} style={{ color:'var(--color-sol-purple)', fontSize:12 }}>
                  replay
                </Link>
              </div>
            );
          })}
        </Panel>
      </main>
      <Footer />
    </>
  );
}
