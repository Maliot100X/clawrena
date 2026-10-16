import { NextResponse } from 'next/server';

// Same-origin LLM proxy for the game's autopilot. The browser never sees a key:
// it posts here, we attach the server-side key and forward to River.
export async function POST(req: Request) {
  const key = process.env.RIVER_API_KEY;
  if (!key) return NextResponse.json({ error: 'no model key configured' }, { status: 500 });

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }

  try {
    const r = await fetch('https://api.river.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: body.model ?? 'deepseek-ai/DeepSeek-V4.1-Flash',
        messages: body.messages,
        max_tokens: Math.min(Number(body.max_tokens) || 64, 256),
        temperature: typeof body.temperature === 'number' ? body.temperature : 0.7,
      }),
    });
    const j = await r.json();
    return NextResponse.json(j, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: 'upstream failed', detail: e.message }, { status: 502 });
  }
}
