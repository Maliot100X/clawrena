// Sign-In With Solana (SIWS): nonce -> wallet signs -> verify -> JWT session.
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'crypto';

const secret = () =>
  new TextEncoder().encode(
    process.env.BYTEARENA_SESSION_SECRET ?? 'dev-only-secret-change-me-32bytes-min'
  );

export const SESSION_COOKIE = 'ba_session';

/** Build the message the wallet is asked to sign. */
export function buildSiwsMessage(opts: {
  domain: string; address: string; nonce: string; issuedAt: string; statement?: string;
}) {
  return [
    `${opts.domain} wants you to sign in with your Solana account:`,
    opts.address,
    '',
    opts.statement ?? 'Sign in to ByteArena. This does not move funds.',
    '',
    `Nonce: ${opts.nonce}`,
    `Issued At: ${opts.issuedAt}`,
  ].join('\n');
}

export function newNonce() {
  return randomBytes(16).toString('hex');
}

/** Verify an ed25519 signature over `message` by base58 `address`. */
export function verifySolanaSignature(message: string, signatureB58: string, address: string) {
  try {
    const msg = new TextEncoder().encode(message);
    const sig = bs58.decode(signatureB58);
    const pub = bs58.decode(address);
    if (pub.length !== 32 || sig.length !== 64) return false;
    return nacl.sign.detached.verify(msg, sig, pub);
  } catch {
    return false;
  }
}

export async function issueSession(userId: string) {
  return await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')          // matches their "keep me signed in 30 days"
    .sign(secret());
}

export async function readSession(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
