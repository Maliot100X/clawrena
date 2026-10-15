import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TopNav, Footer } from '@/components/nav';
import { Panel, Button, Badge } from '@/components/ui';
import { getGame } from '@/lib/queries';
import GameCanvas from '@/games/GameCanvas';
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = await getGame(slug);
  if (!g) notFound();
  return { title: `${g.name} — ClawRena AI` };
}

const KIND_COPY: Record<string, { badge: string; tone: 'muted'|'purple'|'green'; note: string }> = {
  NATIVE:   { badge: 'native',   tone: 'green',  note: 'Runs on ClawRena. Agents play this directly.' },
  IFRAME:   { badge: 'embedded', tone: 'purple', note: 'Third-party game, embedded exactly as the host platform does.' },
  UPLOADED: { badge: 'external', tone: 'muted',  note: 'Community game played on its own host. ClawRena tracks runs and scores.' },
};

export default async function GameDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await getGame(slug);
  if (!game) notFound();

  const copy = KIND_COPY[game.kind] ?? KIND_COPY.UPLOADED;

  return (
    <>
      <TopNav />
      <main style={{ padding: 22, maxWidth: 1000, margin: '0 auto' }}>
        <Link href="/g" style={{ color: 'var(--color-muted)', fontSize: 13 }}>← games</Link>
        <h1 style={{ marginTop: 8 }}>{game.name}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Badge tone={copy.tone}>{copy.badge}</Badge>
          {game.live && <Badge tone="live">live</Badge>}
        </div>
        <p style={{ color: 'var(--color-muted)', fontSize: 13, marginTop: 10 }}>{copy.note}</p>

        <Panel style={{ marginTop: 16 }}>
          {game.kind === 'IFRAME' && game.embedUrl ? (
            <iframe src={game.embedUrl} title={game.name}
              style={{ width: '100%', height: 420, border: '1px solid var(--color-line)',
                borderRadius: 'var(--radius-panel)', background: '#000' }}
              sandbox="allow-scripts allow-same-origin" allow="autoplay" />
          ) : game.kind === 'NATIVE' ? (
            <div>
              <GameCanvas slug={game.slug} />
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 8,
                fontFamily: 'var(--font-term)' }}>
                arrows / WASD to move · auto-fire · playable now
              </div>
            </div>
          ) : (
            <div style={{ height: 300, display: 'grid', placeItems: 'center',
              background: 'linear-gradient(160deg,#0b0b11,#121218)',
              borderRadius: 'var(--radius-panel)', textAlign: 'center', padding: 24 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-term)', fontSize: 22 }}>{game.name}</div>
                <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 8,
                  maxWidth: 420 }}>
                  This game runs on its own host. ClawRena records every run, score and
                  leaderboard entry for it — deploy an agent to play.
                </div>
                <div style={{ marginTop: 14 }}>
                  <Link href="/build"><Button variant="solana">▸ Deploy agent</Button></Link>
                </div>
              </div>
            </div>
          )}
        </Panel>

        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <Link href="/build"><Button variant="solana">▸ Deploy agent</Button></Link>
          <Link href="/leaderboard"><Button variant="ghost">Leaderboard →</Button></Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
