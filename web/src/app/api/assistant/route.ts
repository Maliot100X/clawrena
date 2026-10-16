import { NextResponse } from 'next/server';
import { queryOffers } from '@/lib/aon/client';

// Site assistant — streams a reply and, when the user is shopping, returns real
// AON offers alongside it. Double monetisation: the answer itself + tracked
// offer links attributed to our placement.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM = `You are the ClawRena assistant on clawrena-gray.vercel.app.
ClawRena is a live AI agent arena: people create agents that play games, talk to
chat, and get bet on with points.

Help with: creating agents, going live, games (Blood Arena, Solana Survivors),
wallets, points/predictions, and the leaderboard.
Be short and concrete — 1 to 3 sentences. No markdown headers. No emoji spam.
If the user is clearly shopping for a product (shoes, laptop, phone, headphones…)
say you can pull live prices, and keep it to one line — real offers are attached
separately by the app, never invent prices or products yourself.`;

type Msg = { role: 'user' | 'assistant' | 'system'; content: string };

const SHOPPING = /\b(buy|price|cheap|deal|under \$?\d|shoes|laptop|phone|headphone|monitor|mouse|keyboard|chair|drone|coffee|backpack|tv|tablet|watch|gift)\b/i;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const messages: Msg[] = Array.isArray(body.messages) ? body.messages.slice(-10) : [];
  const last = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';

  if (!last.trim()) return NextResponse.json({ error: 'empty message' }, { status: 400 });

  // --- 1. offers (only when the user is shopping) ---------------------------
  let offers: any[] = [];
  if (SHOPPING.test(last)) {
    try {
      const r = await queryOffers(last.slice(0, 200));
      offers = (r.offers ?? []).slice(0, 3).map(o => ({
        title: o.offer_info?.title,
        price: o.offer_info?.commercial?.price
          ? `${o.offer_info.commercial.price.currency} ${o.offer_info.commercial.price.amount}` : null,
        merchant: o.entity?.name ?? null,
        image: o.material?.[0]?.url ?? null,
        url: o.action?.payload?.url ?? null,
        cta: o.action?.name ?? 'View deal',
      }));
    } catch { /* offers are best-effort; never break the chat */ }
  }

  // --- 2. the reply ---------------------------------------------------------
  let reply = '';
  try {
    const r = await fetch('https://api.river.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json',
                 authorization: `Bearer ${process.env.RIVER_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-V4.1-Flash',
        messages: [{ role: 'system', content: SYSTEM }, ...messages],
        max_tokens: 180, temperature: 0.6,
      }),
    });
    const j = await r.json();
    reply = j?.choices?.[0]?.message?.content?.trim() ?? '';
  } catch { /* fall through */ }

  if (!reply) {
    reply = offers.length
      ? 'Here are live deals I found for that.'
      : 'I can help you create an agent, go live on a game, or find deals. What do you want to do?';
  }

  return NextResponse.json({ reply, offers });
}
