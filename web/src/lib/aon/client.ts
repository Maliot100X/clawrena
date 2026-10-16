// AON (Agent Offer Network) server-side client.
// Docs: /v1/offers/query · /v1/offers/info · /v1/offers/instances ·
//       /v2/developer/reports/offers/batch · webhooks (Protocol v1.0)
// The LIVE key never leaves the server; the browser only ever sees our own API.
import { createHmac, timingSafeEqual } from 'crypto';

const BASE = 'https://api.aon.pro';
const PROTO = '1.0';

function key(): string {
  const k = process.env.AON_API_KEY;
  if (!k) throw new Error('AON_API_KEY not configured');
  return k;
}
function placement(): string {
  const p = process.env.AON_PLACEMENT_ID;
  if (!p) throw new Error('AON_PLACEMENT_ID not configured');
  return p;
}

export interface AonOffer {
  offer_id: string;
  offer_instance_id: string;
  version?: string;
  offer_info: {
    title: string;
    description?: string;
    offer_type?: string;
    category?: { id: string };
    commercial?: { price?: { amount: string; currency: string; unit?: string } };
  };
  entity?: { id?: string; name?: string; logo?: string; website?: string };
  goals?: { description?: string; event?: string;
            pricing?: { amount?: string; currency?: string; model?: string; rate?: string } }[];
  action?: { consumer_action?: string; name?: string; type?: string;
             payload?: { url?: string } };
  material?: { dimensions?: string; format?: string; tag?: string; url: string }[];
  content_language?: string;
}

export interface AonQueryResult {
  offers: AonOffer[];
  request_id?: string;
  is_test?: boolean;
  empty_reason?: string;
}

/** POST /v1/offers/query — find offers for an intent. */
export async function queryOffers(intent: string, opts?: {
  provenance?: string; constraints?: Record<string, unknown>; page?: number;
}): Promise<AonQueryResult> {
  const body: Record<string, unknown> = {
    intent: {
      content: [{ type: 'input_text', text: intent.slice(0, 200) }],
      provenance: opts?.provenance ?? 'user_expressed',
    },
    context: {},
  };
  if (opts?.constraints) body.constraints = opts.constraints;
  if (opts?.page) body.pagination = { page: opts.page };

  const r = await fetch(`${BASE}/v1/offers/query`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key()}`,
      'AON-Protocol-Version': PROTO,
      'X-AON-Placement-Id': placement(),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const j = await r.json();
  if (!r.ok || j.code !== 'SUCCESS') {
    throw new Error(`AON query failed: ${j.code ?? r.status} ${j.message ?? ''}`);
  }
  const d = j.data ?? {};
  return { offers: d.offers ?? [], request_id: d.request_id,
           is_test: j.extra?.is_test, empty_reason: d.empty_reason };
}

/** POST /v1/offers/info — batch details by canonical offer_id (max 1000). */
export async function offerInfo(offerIds: string[]) {
  const r = await fetch(`${BASE}/v1/offers/info`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key()}` },
    body: JSON.stringify({ offer_ids: offerIds.slice(0, 1000) }),
    cache: 'no-store',
  });
  const j = await r.json();
  if (!r.ok || j.code !== 'SUCCESS') throw new Error(`AON offerInfo failed: ${j.code ?? r.status}`);
  return j.data?.offers ?? [];
}

/** POST /v1/offers/instances — look up cards we served (max 100). */
export async function offerInstances(instanceIds: string[]) {
  if (!instanceIds.length) return [];
  const r = await fetch(`${BASE}/v1/offers/instances`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key()}` },
    body: JSON.stringify({ offer_instance_ids: instanceIds.slice(0, 100) }),
    cache: 'no-store',
  });
  const j = await r.json();
  if (!r.ok || j.code !== 'SUCCESS') throw new Error(`AON instances failed: ${j.code ?? r.status}`);
  return j.data?.offers ?? [];
}

/** POST /v2/developer/reports/offers/batch — earnings in USD. */
export async function reportEarnings(pairs: { placement_id: string; offer_id: string }[],
                                     from: string, to: string) {
  const r = await fetch(`${BASE}/v2/developer/reports/offers/batch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key()}` },
    body: JSON.stringify({ items: pairs, from, to }),
    cache: 'no-store',
  });
  const j = await r.json();
  if (!r.ok || j.code !== 'SUCCESS') throw new Error(`AON report failed: ${j.code ?? r.status}`);
  return j.data?.results ?? [];
}

/**
 * Verify an inbound AON webhook (Protocol v1.0).
 * Rejects missing/duplicate security headers, then HMAC-SHA256 over the raw
 * body. `secret` comes from the portal's callback key (X-AON-Key selects it).
 */
export interface WebhookHeaders {
  protocolVersion?: string | null;
  keyId?: string | null;
  timestamp?: string | null;
  signature?: string | null;
  requestTarget: string;          // path + query, exactly as received
}

export type WebhookResult =
  | { ok: true; event: any; eventId?: string }
  | { ok: false; status: number; reason: string };

/**
 * Verify an inbound AON webhook (Protocol v1.0). Exact spec:
 *
 *   signing_string = "POST\n" + request_target + "\n" + raw_body + "\n" + timestamp
 *   signature      = hex( HMAC_SHA256( secret, signing_string ) )
 *
 * Use the raw body bytes and the request target exactly as received — do not
 * re-serialize, reorder or decode anything first.
 *
 * Rejects: wrong/absent protocol version, unknown key id, timestamp more than
 * 300s from our clock, and any signature mismatch (constant-time compare).
 */
export function verifyWebhook(
  rawBody: string,
  h: WebhookHeaders,
  secrets: Record<string, string>,
): WebhookResult {
  const proto = h.protocolVersion;
  const keyId = h.keyId;
  const ts = h.timestamp;
  const sig = h.signature;

  if (proto !== PROTO) return { ok: false, status: 400, reason: 'unsupported protocol version' };
  if (!keyId || !ts || !sig) return { ok: false, status: 400, reason: 'missing security header' };
  if (keyId.startsWith('aon_cb_') === false) return { ok: false, status: 400, reason: 'malformed key id' };

  const secret = secrets[keyId];
  if (!secret) return { ok: false, status: 401, reason: 'unknown key id' };

  // timestamp must be within 300s of our clock
  const now = Math.floor(Date.now() / 1000);
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(now - t) > 300) {
    return { ok: false, status: 401, reason: 'timestamp out of window' };
  }

  const signingString = `POST\n${h.requestTarget}\n${rawBody}\n${ts}`;
  const expected = createHmac('sha256', secret).update(signingString).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(sig, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, reason: 'bad signature' };
  }

  let event: any;
  try { event = JSON.parse(rawBody); }
  catch { return { ok: false, status: 400, reason: 'invalid json' }; }

  return { ok: true, event, eventId: event?.event_id ?? event?.id };
}
