import { NextResponse } from 'next/server';
// Agent voice preview — proxies to the arena's Deepgram TTS.
// Lets the create flow play a sample BEFORE the agent exists.
const ARENA = process.env.ARENA_HTTP ?? 'http://localhost:4100';

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const text = String(b.text ?? '').slice(0, 400);
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });
  try {
    const r = await fetch(`${ARENA}/voice/speak`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, voiceId: b.voiceId ?? 'server-default', emotion: b.emotion }),
    });
    if (!r.ok) {
      const t = await r.text();
      return NextResponse.json({ error: `tts ${r.status}`, detail: t.slice(0, 200) }, { status: 502 });
    }
    return new NextResponse(await r.arrayBuffer(), {
      headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' },
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'arena unreachable', detail: e.message }, { status: 502 });
  }
}
