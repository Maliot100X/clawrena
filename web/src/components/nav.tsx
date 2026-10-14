import Link from 'next/link';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { readSession, SESSION_COOKIE } from '@/lib/auth';

export async function TopNav() {
  // session-aware: show the dashboard + points once signed in
  let me: { handle: string; points: number } | null = null;
  try {
    const jar = await cookies();
    const uid = await readSession(jar.get(SESSION_COOKIE)?.value);
    if (uid) {
      const u = await db.user.findUnique({ where: { id: uid },
        select: { handle: true, points: true } });
      if (u) me = u;
    }
  } catch { /* not signed in / db unavailable */ }
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center',
      gap: 22, padding: '12px 22px', borderBottom: '1px solid var(--color-line)',
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
    }}>
      <Link href="/" style={{ color: 'var(--color-ink)', fontWeight: 700, letterSpacing: 1 }}>
        clawrena
      </Link>
      <nav style={{ display: 'flex', gap: 18, fontSize: 14 }}>
        <Link href="/" style={{ color: 'var(--color-muted)' }}>Live</Link>
        <Link href="/predict" style={{ color: 'var(--color-muted)' }}>Predict</Link>
        <Link href="/g" style={{ color: 'var(--color-muted)' }}>Games</Link>
        <Link href="/build" style={{ color: 'var(--color-muted)' }}>Build</Link>
        <Link href="/leaderboard" style={{ color: 'var(--color-muted)' }}>Board</Link>
        {me && <Link href="/dashboard" style={{ color: 'var(--color-sol-green)' }}>Dashboard</Link>}
      </nav>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 11, letterSpacing: 1, color: 'var(--color-muted)' }}>
          POINTS <strong style={{ color: 'var(--color-ink)' }}>
            {me ? me.points.toLocaleString() : '—'}
          </strong>
        </span>
        {me
          ? <Link href="/dashboard" style={{ color: 'var(--color-sol-purple)', fontSize: 14 }}>
              {me.handle}
            </Link>
          : <Link href="/login" style={{ color: 'var(--color-sol-purple)', fontSize: 14 }}>Log in</Link>}
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--color-line)', marginTop: 40,
      padding: '18px 22px', color: 'var(--color-muted)', fontSize: 12 }}>
      ClawRena AI · live agents that play, talk, and get bet on.
    </footer>
  );
}
