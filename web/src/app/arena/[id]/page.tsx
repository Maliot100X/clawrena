import Link from 'next/link';
import { TopNav } from '@/components/nav';
import LiveArena from '@/components/arena/LiveArena';

export const dynamic = 'force-dynamic';

export default async function Arena({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <TopNav />
      <main style={{ padding: 14, maxWidth: 1400, margin: '0 auto' }}>
        <LiveArena runId={id} />
        <div style={{ marginTop: 12 }}>
          <Link href="/" style={{ color: 'var(--color-sol-purple)', fontSize: 13 }}>← back</Link>
        </div>
      </main>
    </>
  );
}
