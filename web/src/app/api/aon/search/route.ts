import { NextResponse } from 'next/server';
import { queryOffers } from '@/lib/aon/client';

// Public search endpoint: the browser asks us, we call AON with the server key.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const intent = String(body.intent ?? '').trim();
  if (intent.length < 2) return NextResponse.json({ error: 'intent too short' }, { status: 400 });
  if (intent.length > 200) return NextResponse.json({ error: 'intent too long (max 200)' }, { status: 400 });
  try {
    const r = await queryOffers(intent);
    return NextResponse.json({ offers: r.offers, is_test: r.is_test ?? false });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
