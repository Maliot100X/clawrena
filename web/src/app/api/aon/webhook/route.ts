import { NextResponse } from 'next/server';
import { verifyWebhook } from '@/lib/aon/client';

// AON conversion + earning-lifecycle webhooks (Protocol v1.0).
//
// Rules from the spec:
//  - verify BEFORE parsing or acting on the body
//  - use the raw bytes and the request target exactly as received
//  - acknowledge within 10s (we do the work synchronously: it is tiny)
//  - dedupe by (application, event_id) for 24h: a repeat returns 2xx with no
//    second side effect; the SAME event id with a DIFFERENT body is a 409
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// In-memory seen-set is fine for a single instance; move to Redis to survive
// restarts and to be correct across instances.
const seen = new Map<string, { digest: string; at: number }>();
const DAY = 86_400_000;

function prune() {
  const cut = Date.now() - DAY;
  for (const [k, v] of seen) if (v.at < cut) seen.delete(k);
}

export async function POST(req: Request) {
  const raw = await req.text();                    // raw bytes first
  const url = new URL(req.url);
  const requestTarget = url.pathname + url.search; // path + query, as received

  // key id -> secret. The portal shows the id (aon_cb_v1); only the secret is
  // secret. A replaced secret bumps the id, so keep the map, not a single value.
  const secrets: Record<string, string> = {};
  const id = process.env.AON_WEBHOOK_KEY_ID ?? 'aon_cb_v1';
  if (process.env.AON_WEBHOOK_SECRET) secrets[id] = process.env.AON_WEBHOOK_SECRET;

  if (!Object.keys(secrets).length) {
    console.error('[aon webhook] AON_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'webhook not configured' }, { status: 503 });
  }

  const v = verifyWebhook(raw, {
    protocolVersion: req.headers.get('aon-protocol-version'),
    keyId: req.headers.get('x-aon-key'),
    timestamp: req.headers.get('x-aon-timestamp'),
    signature: req.headers.get('x-aon-signature'),
    requestTarget,
  }, secrets);

  if (!v.ok) {
    console.warn('[aon webhook] rejected:', v.reason);
    return NextResponse.json({ error: v.reason }, { status: v.status });
  }

  const event = v.event;
  const eventId = String(v.eventId ?? '');

  // --- dedupe ---------------------------------------------------------------
  prune();
  const digest = createHash('sha256').update(raw).digest('hex');
  const prior = eventId ? seen.get(eventId) : undefined;
  if (prior) {
    if (prior.digest === digest) return NextResponse.json({ ok: true, duplicate: true });
    return NextResponse.json({ error: 'event id conflict' }, { status: 409 });
  }
  if (eventId) seen.set(eventId, { digest, at: Date.now() });

  // --- handle ---------------------------------------------------------------
  const type = event?.event_type ?? event?.type ?? 'unknown';
  console.log(`[aon webhook] ${type}`, JSON.stringify(event).slice(0, 800));

  switch (type) {
    case 'conversion':
      // a conversion was attributed. Money, not yet confirmed.
      break;
    case 'earning_confirmed':
      break;
    case 'earning_available':
      // the Partner paid; this earning is now payable out to us
      break;
    case 'earning_paid_out':
      break;
    case 'earning_rejected':
      // reversed / refunded — subtract from expected
      break;
    default:
      console.warn('[aon webhook] unhandled event_type:', type);
  }

  // Respond fast. Delivered events are retried on a 1m/5m/30m/2h schedule.
  return NextResponse.json({ ok: true, received: type });
}

import { createHash } from 'crypto';
