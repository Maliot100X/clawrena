import { NextResponse } from 'next/server';
import { newNonce, buildSiwsMessage } from '@/lib/auth';

export async function POST(req: Request) {
  const { address } = await req.json().catch(() => ({}));
  if (typeof address !== 'string' || address.length < 32) {
    return NextResponse.json({ error: 'address required' }, { status: 400 });
  }
  const nonce = newNonce();
  const issuedAt = new Date().toISOString();
  const domain = new URL(req.url).host;
  const message = buildSiwsMessage({ domain, address, nonce, issuedAt });
  const res = NextResponse.json({ message, nonce });
  // bind nonce to this browser for 5 minutes
  res.cookies.set('ba_nonce', nonce, { httpOnly: true, sameSite: 'lax', maxAge: 300, path: '/' });
  return res;
}
