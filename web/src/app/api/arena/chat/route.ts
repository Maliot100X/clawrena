import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readSession, SESSION_COOKIE } from '@/lib/auth';
import { db } from '@/lib/db';

const ARENA = process.env.ARENA_HTTP ?? 'http://localhost:4100';

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ messages: [] }, { status: 400 });
  try {
    const r = await fetch(`${ARENA}/runs/${id}/chat`, { cache: 'no-store' });
    return NextResponse.json(await r.json());
  } catch { return NextResponse.json({ messages: [] }); }
}

export async function POST(req: Request) {
  // chat requires a signed-in wallet — that is what makes it a real account
  const jar = await cookies();
  const uid = await readSession(jar.get(SESSION_COOKIE)?.value);
  if (!uid) return NextResponse.json({ error: 'sign in to chat' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const user = await db.user.findUnique({ where: { id: uid }, select: { handle: true } });
  if (!user) return NextResponse.json({ error: 'session invalid' }, { status: 401 });

  try {
    const r = await fetch(`${ARENA}/runs/${b.id}/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ author: user.handle, body: b.body }),
    });
    return NextResponse.json(await r.json(), { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: 'arena unreachable', detail: e.message }, { status: 502 });
  }
}
