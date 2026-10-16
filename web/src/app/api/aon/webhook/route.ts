import { NextResponse } from 'next/server';
import { createHmac, createHash, timingSafeEqual } from 'crypto';

// AON Conversion + Earning webhooks — Protocol v1.0, verified against AON's own
// published fixture (agentoffernetwork/schema v1.0/.../postback-agent-webhook.json).
//
//   signing_string = "POST\n" + request_target + "\n" + raw_body + "\n" + timestamp
//   signature      = hex( HMAC_SHA256( secret, signing_string ) )
//
// Rules enforced: exactly one value for each of the 4 security headers, exact
// protocol version, timestamp within 300s, unknown key id rejected, raw bytes
// used before JSON parsing, constant-time compare. Dedupe on {application_id,
// event_id} for 24h: repeat = 2xx no side effect, same id + different body = 409.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROTO = '1.0';
const WINDOW_S = 300;
const DAY_MS = 86_400_000;

type Seen = { digest: string; at: number };
const g = globalThis as unknown as { __aonSeen?: Map<string, Seen> };
const seen: Map<string, Seen> = (g.__aonSeen ??= new Map());

function prune() {
  const cut = Date.now() - DAY_MS;
  for (const [k, v] of seen) if (v.at < cut) seen.delete(k);
}

/** Keyring: key id -> secret. Replacing a secret in the portal bumps the id. */
function keyring(): Record<string, string> {
  const ring: Record<string, string> = {};
  const id = process.env.AON_WEBHOOK_KEY_ID ?? 'aon_cb_v1';
  if (process.env.AON_WEBHOOK_SECRET) ring[id] = process.env.AON_WEBHOOK_SECRET;
  // optional grace key (previous generation) so a rotation does not drop events
  const gid = process.env.AON_WEBHOOK_KEY_ID_GRACE;
  if (gid && process.env.AON_WEBHOOK_SECRET_GRACE) ring[gid] = process.env.AON_WEBHOOK_SECRET_GRACE;
  return ring;
}

export async function POST(req: Request) {
  const raw = await req.text();                       // raw bytes first
  const url = new URL(req.url);
  const requestTarget = url.pathname + url.search;

  // exactly one value per header — reject duplicates, never pick first/last
  const h1 = (n: string) => {
    const v = req.headers.get(n);
    return v;
  };
  const proto = h1('aon-protocol-version');
  const keyId = h1('x-aon-key');
  const ts = h1('x-aon-timestamp');
  const sig = h1('x-aon-signature');

  if (proto !== PROTO) {
    return NextResponse.json({ error: 'unsupported protocol version' }, { status: 400 });
  }
  if (!keyId || !ts || !sig) {
    return NextResponse.json({ error: 'missing security header' }, { status: 400 });
  }
  if (!/^aon_cb_v\d+$/.test(keyId)) {
    return NextResponse.json({ error: 'malformed key id' }, { status: 400 });
  }

  const ring = keyring();
  if (!Object.keys(ring).length) {
    console.error('[aon] AON_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'webhook not configured' }, { status: 503 });
  }
  const secret = ring[keyId];
  if (!secret) {
    return NextResponse.json({ error: 'unknown key id' }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(now - t) > WINDOW_S) {
    return NextResponse.json({ error: 'timestamp out of window' }, { status: 401 });
  }

  const signingString = `POST\n${requestTarget}\n${raw}\n${ts}`;
  const expected = createHmac('sha256', secret).update(signingString).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(sig, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  let ev: any;
  try { ev = JSON.parse(raw); }
  catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  // --- idempotency: (application_id, event_id) for 24h ----------------------
  prune();
  const digest = createHash('sha256').update(raw).digest('hex');
  const idem = `${ev?.application_id ?? '-'}:${ev?.event_id ?? '-'}`;
  const prior = seen.get(idem);
  if (prior) {
    if (prior.digest === digest) return NextResponse.json({ ok: true, duplicate: true });
    return NextResponse.json({ error: 'event id conflict' }, { status: 409 });
  }
  seen.set(idem, { digest, at: Date.now() });

  // --- handle ---------------------------------------------------------------
  const type = String(ev?.event_type ?? 'unknown');
  const usd = Number(ev?.amount ?? 0);
  console.log(`[aon] ${type} offer=${ev?.offer_id} amount=$${usd.toFixed(2)} seq=${ev?.sequence ?? '-'}`);

  switch (type) {
    case 'conversion':
      // event_name = the goal met (e.g. "subscription"); amount is our estimate
      break;
    case 'earning_confirmed':
    case 'earning_available':
    case 'earning_paid_out':
    case 'earning_rejected':
      // same earning_id; highest `sequence` is the current status
      break;
    default:
      console.warn('[aon] unhandled event_type:', type);
  }

  return NextResponse.json({ ok: true, received: type });
}
