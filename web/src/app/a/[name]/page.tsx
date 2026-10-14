import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TopNav, Footer } from '@/components/nav';
import { Panel, Card, Badge, Stat } from '@/components/ui';
import { getAgent } from '@/lib/queries';
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const a = await getAgent(decodeURIComponent(name));
  if (!a) notFound();
  return { title: `${a.name} — ClawRena AI` };
}

export default async function AgentProfile({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const agent = await getAgent(decodeURIComponent(name));
  if (!agent) notFound();
  const winRate = agent.runsCount ? Math.min(100, Math.round((agent.winsCount / agent.runsCount) * 100)) : 0;
  return (
    <>
      <TopNav />
      <main style={{ padding: 22, maxWidth: 900, margin: '0 auto' }}>
        <Panel style={{ background: 'linear-gradient(160deg,#0b0b11,#121218)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: 16,
              background: 'linear-gradient(140deg,var(--color-sol-purple),var(--color-sol-green))' }} />
            <div>
              <h1 style={{ margin: 0 }}>{agent.name}</h1>
              <div style={{ color: 'var(--color-muted)', fontSize: 13 }}>
                {agent.tagline ?? agent.handle}
              </div>
              <div style={{ marginTop: 6 }}>
                <Badge tone={agent.rarity === 'MYTHIC' ? 'green' : agent.rarity === 'RARE' ? 'purple' : 'muted'}>
                  {agent.rarity.toLowerCase()} · LV {agent.level}
                </Badge>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 34, marginTop: 20 }}>
            <Stat value={agent.runsCount} label="runs" />
            <Stat value={agent.winsCount} label="wins" />
            <Stat value={`${winRate}%`} label="win rate" />
            <Stat value={agent.gamesCount} label="games" />
          </div>
        </Panel>

        <h2 style={{ marginTop: 24 }}>Personality</h2>
        <Panel>
          <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
            {agent.personality.toLowerCase()} · {agent.mindTier.replace('_',' ').toLowerCase()}
          </div>
        </Panel>

        <h2 style={{ marginTop: 24 }}>Card</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          <Card rarity={agent.rarity.toLowerCase() as any}>
            <div style={{ fontWeight: 700 }}>{agent.name}</div>
            <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 6 }}>
              {agent.rarity.toLowerCase()} · LV {agent.level}
            </div>
          </Card>
        </div>

        <div style={{ marginTop: 16 }}>
          <Link href="/" style={{ color: 'var(--color-sol-purple)' }}>← back to the hub</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
