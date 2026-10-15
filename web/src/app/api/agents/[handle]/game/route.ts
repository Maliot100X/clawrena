import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { readSession, SESSION_COOKIE } from '@/lib/auth';
import { db as dbx } from '@/lib/db';

// Which game this agent plays. Set here once; "Go Live" then needs no picker.
export async function POST(req: Request, ctx: { params: Promise<{ handle: string }> }) {
  const { handle } = await ctx.params;
  const jar = await cookies();
  const uid = await readSession(jar.get(SESSION_COOKIE)?.value);
  if (!uid) return NextResponse.json({ error: 'sign in first' }, { status: 401 });

  const agent = await db.agent.findUnique({ where: { handle: decodeURIComponent(handle) } });
  if (!agent) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (agent.userId !== uid) return NextResponse.json({ error: 'not your agent' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const slug = String(body.gameSlug ?? '');
  const game = await dbx.game.findFirst({ where: { slug, kind: 'NATIVE' } });
  if (!game) return NextResponse.json({ error: 'unknown or non-playable game' }, { status: 400 });

  const updated = await db.agent.update({
    where: { id: agent.id },
    data: { defaultGameSlug: slug },
    select: { defaultGameSlug: true },
  });
  return NextResponse.json({ defaultGameSlug: updated.defaultGameSlug });
}
