import Link from 'next/link';
import { TopNav } from '@/components/nav';
import LiveArena from '@/components/arena/LiveArena';
import { db } from '@/lib/db';
import { avatarFor } from '@/lib/avatars';

export const dynamic = 'force-dynamic';

export default async function Arena({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // resolve the agent's chosen avatar (falls back to the default VRoid model)
  let avatarFile = avatarFor(null).file;
  let agentName = 'agent';
  let gameSlug: string | undefined;
  try {
    const run = await db.run.findUnique({
      where: { id }, include: { agent: { select: { name: true, bodyModel: true, defaultGameSlug: true } }, game: { select: { slug: true } } },
    });
    if (run?.agent) {
      agentName = run.agent.name;
      avatarFile = avatarFor(run.agent.bodyModel).file;
      gameSlug = (run as any).game?.slug ?? run.agent.defaultGameSlug ?? undefined;
    }
  } catch { /* arena may not be linked; keep defaults */ }

  return (
    <>
      <TopNav />
      <main style={{ padding: 14, maxWidth: 1400, margin: '0 auto' }}>
        <LiveArena runId={id} avatarFile={avatarFile} agentName={agentName} slug={gameSlug} />
        <div style={{ marginTop: 12 }}>
          <Link href="/" style={{ color: 'var(--color-sol-purple)', fontSize: 13 }}>← back</Link>
        </div>
      </main>
    </>
  );
}
