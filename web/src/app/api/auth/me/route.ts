import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { readSession, SESSION_COOKIE } from '@/lib/auth';

export async function GET() {
  const jar = await cookies();
  const userId = await readSession(jar.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ authed: false }, { status: 200 });
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { handle: true, points: true, walletSolana: true, proPlan: true },
  });
  if (!user) return NextResponse.json({ authed: false }, { status: 200 });
  return NextResponse.json({ authed: true, ...user });
}
