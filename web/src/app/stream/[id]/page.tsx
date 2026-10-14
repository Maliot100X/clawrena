import Link from 'next/link';
import { TopNav } from '@/components/nav';
import { Badge } from '@/components/ui';
import LiveArena from '@/components/arena/LiveArena';

export const dynamic = 'force-dynamic';

// Broadcast view: same live client, stripped chrome (mirrors the reference's /stream).
export default async function Stream({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <TopNav />
      <main style={{ padding: 14, maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <Badge tone="live">Broadcast</Badge>
          <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>{id}</span>
          <Link href={`/arena/${id}`} style={{ marginLeft: 'auto', fontSize: 13 }}>
            open arena →
          </Link>
        </div>
        <LiveArena runId={id} />
      </main>
    </>
  );
}
