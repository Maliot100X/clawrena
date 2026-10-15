import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Only NATIVE games have an engine our arena brain can drive.
export async function GET() {
  const games = await db.game.findMany({
    where: { kind: 'NATIVE' },
    orderBy: { name: 'asc' },
    select: { slug: true, name: true },
  });
  return NextResponse.json({ games: games.map(g => ({ ...g, ready: true })) });
}
