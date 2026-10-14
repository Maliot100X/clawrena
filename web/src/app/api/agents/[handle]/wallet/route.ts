import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { readSession, SESSION_COOKIE } from '@/lib/auth';
import { shortKey, decrypt, pubkeyOf, generateWallet } from '@/lib/wallet';

async function owned(handle: string) {
  const jar = await cookies();
  const uid = await readSession(jar.get(SESSION_COOKIE)?.value);
  if (!uid) return { err: 'sign in first', code: 401 as const };
  const agent = await db.agent.findUnique({
    where: { handle: decodeURIComponent(handle) },
    include: { wallet: true },
  });
  if (!agent) return { err: 'agent not found', code: 404 as const };
  if (agent.userId !== uid) return { err: 'not your agent', code: 403 as const };
  return { agent, uid };
}

// The agent's own public wallet address (for airdrops). Never the secret.
export async function GET(_r: Request, ctx: { params: Promise<{ handle: string }> }) {
  const { handle } = await ctx.params;
  const res = await owned(handle);
  if ('err' in res) return NextResponse.json({ error: res.err }, { status: res.code });
  const w = res.agent.wallet;
  return NextResponse.json({
    publicKey: w?.solanaPub ?? null,
    short: w ? shortKey(w.solanaPub) : null,
  });
}

// "Generate / replace wallet" — issues a fresh keypair for the agent.
export async function POST(_r: Request, ctx: { params: Promise<{ handle: string }> }) {
  const { handle } = await ctx.params;
  const res = await owned(handle);
  if ('err' in res) return NextResponse.json({ error: res.err }, { status: res.code });

  const existing = res.agent.wallet;
  if (existing) {
    // refuse to silently destroy a funded wallet
    return NextResponse.json({
      error: 'agent already has a wallet',
      publicKey: existing.solanaPub,
    }, { status: 409 });
  }
  const w = generateWallet();
  await db.agentWallet.create({ data: {
    agentId: res.agent.id, solanaPub: w.publicKey, encSecret: w.encSecret } });
  return NextResponse.json({ ok: true, publicKey: w.publicKey, short: shortKey(w.publicKey) });
}
