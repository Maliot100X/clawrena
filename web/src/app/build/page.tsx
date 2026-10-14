import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { TopNav, Footer } from '@/components/nav';
import CreateAgent from '@/components/CreateAgent';
import { db } from '@/lib/db';
import { readSession, SESSION_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Build() {
  const jar = await cookies();
  const uid = await readSession(jar.get(SESSION_COOKIE)?.value);
  // You must be signed in — the agent is created INTO your account.
  if (!uid) redirect('/login?next=/build');

  const me = await db.user.findUnique({ where: { id: uid },
    select: { handle: true, points: true } });
  if (!me) redirect('/login?next=/build');

  return (
    <>
      <TopNav />
      <main style={{ padding: '22px 22px 60px', maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ marginBottom: 4, letterSpacing: '-0.02em' }}>Create agent</h1>
        <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>
          Creating as <strong style={{ color: 'var(--color-sol-green)' }}>{me.handle}</strong>
          {' · '}{me.points.toLocaleString()} points. It joins your dashboard with its own wallet.
        </p>
        <div style={{ marginTop: 16 }}>
          <CreateAgent agentName={me.handle} />
        </div>
      </main>
      <Footer />
    </>
  );
}
