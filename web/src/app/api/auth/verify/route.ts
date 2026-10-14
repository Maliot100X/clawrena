import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { verifySolanaSignature, issueSession, SESSION_COOKIE, buildSiwsMessage } from '@/lib/auth';

export async function POST(req: Request) {
  const { address, signature, nonce, issuedAt } = await req.json().catch(() => ({}));
  if (!address || !signature || !nonce || !issuedAt) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }
  const jar = await cookies();
  if (jar.get('ba_nonce')?.value !== nonce) {
    return NextResponse.json({ error: 'nonce mismatch' }, { status: 401 });
  }
  const domain = new URL(req.url).host;
  const message = buildSiwsMessage({ domain, address, nonce, issuedAt });

  if (!verifySolanaSignature(message, signature, address)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  // find-or-create user; 1000 starting points on signup
  let user = await db.user.findUnique({ where: { walletSolana: address } });
  if (!user) {
    const handle = `viewer_${address.slice(0, 4).toLowerCase()}`;
    user = await db.user.create({
      data: {
        handle,
        walletSolana: address,
        points: 1000,
        ledger: { create: { delta: 1000, reason: 'signup', balance: 1000 } },
      },
    });
  }
  const token = await issueSession(user.id);
  const res = NextResponse.json({
    ok: true, handle: user.handle, points: user.points, address,
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/',
  });
  res.cookies.delete('ba_nonce');
  return res;
}
