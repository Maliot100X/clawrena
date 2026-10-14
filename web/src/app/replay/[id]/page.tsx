import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TopNav, Footer } from '@/components/nav';
import { Panel, Badge } from '@/components/ui';
import { db } from '@/lib/db';
import ReplayPlayer from '@/components/ReplayPlayer';

export const dynamic = 'force-dynamic';

export default async function Replay({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await db.run.findUnique({
    where: { id },
    include: { agent: true, game: true,
      events: { orderBy: { seq: 'asc' } },
      messages: { orderBy: { at: 'asc' }, take: 60 },
      markets: true },
  });
  if (!run) notFound();

  return (
    <>
      <TopNav />
      <main style={{ padding: 22, maxWidth: 1000, margin: '0 auto' }}>
        <Link href="/" style={{ color: 'var(--color-muted)', fontSize: 13 }}>← back</Link>
        <h1 style={{ marginTop: 8 }}>
          replay · {run.agent.name}
        </h1>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Badge tone={run.result === 'won' ? 'green' : 'muted'}>
            {run.result ?? run.status.toLowerCase()}
          </Badge>
          <Badge tone="purple">{run.game.name}</Badge>
          <Badge>{run.events.length} events</Badge>
        </div>

        <Panel>
          <ReplayPlayer events={run.events.map(e => ({ seq: e.seq, type: e.type, payload: e.payload }))}
            agent={run.agent.name} game={run.game.name} />
        </Panel>

        {run.messages.length > 0 && (
          <>
            <h2 style={{ marginTop: 24 }}>What it said</h2>
            <Panel>
              {run.messages.slice(0, 20).map(m => (
                <div key={m.id} style={{ marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--color-sol-purple)' }}>{m.author}</span>{' '}
                  <span>{m.body}</span>
                </div>
              ))}
            </Panel>
          </>
        )}

        {run.markets.length > 0 && (
          <>
            <h2 style={{ marginTop: 24 }}>Markets</h2>
            <Panel>
              {run.markets.map(m => (
                <div key={m.id} style={{ display:'flex', justifyContent:'space-between',
                  fontSize: 13, marginBottom: 6 }}>
                  <span>{m.question}</span>
                  <span style={{ color: m.outcome === null ? 'var(--color-muted)'
                    : m.outcome ? 'var(--color-sol-green)' : 'var(--color-red)' }}>
                    {m.status.toLowerCase()}{m.outcome !== null ? ` · ${m.outcome ? 'YES' : 'NO'}` : ''} · pot {m.pot}
                  </span>
                </div>
              ))}
            </Panel>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
