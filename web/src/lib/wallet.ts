// Per-agent Solana wallets. Each agent gets its OWN keypair (matching the
// reference: "It also gets its own wallet (one address per network) so it can
// pay to play"). Secrets are AES-256-GCM encrypted at rest and never returned
// by any query.
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

function masterKey(): Buffer {
  const raw = process.env.BYTEARENA_WALLET_SECRET ?? process.env.BYTEARENA_SESSION_SECRET;
  if (!raw) throw new Error('BYTEARENA_WALLET_SECRET / BYTEARENA_SESSION_SECRET not set');
  return scryptSync(raw, 'clawrena-wallet-v1', 32);
}

export interface NewWallet { publicKey: string; encSecret: string; }

/** Generate a fresh ed25519 keypair and return pubkey + encrypted secret. */
export function generateWallet(): NewWallet {
  const kp = nacl.sign.keyPair();
  const pub = bs58.encode(kp.publicKey);
  const secret = bs58.encode(kp.secretKey);
  return { publicKey: pub, encSecret: encrypt(secret) };
}

export function encrypt(plain: string): string {
  const key = masterKey();
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

export function decrypt(blob: string): string {
  const [ivB, tagB, dataB] = blob.split(':');
  const d = createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(ivB, 'base64'));
  d.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([d.update(Buffer.from(dataB, 'base64')), d.final()]).toString('utf8');
}

/** Derive the pubkey back out of a stored secret — used to verify round-trip. */
export function pubkeyOf(secretB58: string): string {
  return bs58.encode(nacl.sign.keyPair.fromSecretKey(bs58.decode(secretB58)).publicKey);
}

/** Short display form: 7Uj1555q…r5fwfD (mirrors the reference's truncation). */
export function shortKey(k: string): string {
  return k.length > 12 ? `${k.slice(0, 7)}…${k.slice(-6)}` : k;
}
