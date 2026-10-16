import { NextResponse } from 'next/server';
import { queryOffers, reportEarnings } from '@/lib/aon/client';

// What this placement has earned, straight from AON Reporting v2.
export async function GET() {
  try {
    // Reporting needs placement_id + offer_id pairs — take them from a live query.
    const q = await queryOffers('popular products');
    const pairs = q.offers.slice(0, 20).map(o => ({
      placement_id: process.env.AON_PLACEMENT_ID!, offer_id: o.offer_id,
    }));
    if (!pairs.length) return NextResponse.json({ clicks: 0, conversions: 0, usd: 0, offers: 0 });

    const to = new Date(); to.setUTCMinutes(0, 0, 0);
    const from = new Date(to.getTime() - 30 * 86400_000);
    const rows = await reportEarnings(pairs, from.toISOString().replace('.000',''),
                                      to.toISOString().replace('.000',''));

    const clicks = rows.reduce((s: number, r: any) => s + (r.data?.clicks ?? 0), 0);
    const conversions = rows.reduce((s: number, r: any) => s + (r.data?.conversions ?? 0), 0);
    const usd = rows.reduce((s: number, r: any) =>
      s + Number(r.data?.estimated_earnings?.[0]?.amount ?? 0), 0);

    return NextResponse.json({ clicks, conversions, usd: Number(usd.toFixed(2)),
                               offers: pairs.length, window_days: 30,
                               payout_threshold_usd: 50,
                               payout_unlocked: usd >= 50 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
