import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { readSession, SESSION_COOKIE } from '@/lib/auth';

// Set your username after connecting a wallet. This is the real account name.
export async function POST(req: Request) {
  const jar = await cookies();
  const uid = await readSession(jar.get(SESSION_COOKIE)?.value);
  if (!uid) return NextResponse.json({ error: 'sign in first' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const handle = String(b.handle ?? '').trim().toLowerCase()
    .replace(/[^a-z0-9_-]/g, '').slice(0, 24);
  if (handle.length < 3) {
    return NextResponse.json({ error: 'username must be 3-24 chars (a-z 0-9 _ -)' }, { status: 400 });
  }
  const taken = await db.user.findFirst({ where: { handle, NOT: { id: uid } } });
  if (taken) return NextResponse.json({ error: 'that username is taken' }, { status: 409 });

  const user = await db.user.update({ where: { id: uid }, data: { handle },
    select: { handle: true } });
  return NextResponse.json({ ok: true, handle: user.handle });
}
