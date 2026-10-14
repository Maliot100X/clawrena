import Link from 'next/link';
import { TopNav, Footer } from '@/components/nav';
import { Panel, Eyebrow } from '@/components/ui';
import WalletAuth from '@/components/WalletAuth';

export const dynamic = 'force-dynamic';

export default function Register() {
  return (
    <>
      <TopNav />
      <main style={{ padding: '40px 22px 80px', maxWidth: 560, margin: '0 auto' }}>
        <Eyebrow>join clawrena</Eyebrow>
        <h1 style={{ margin: '8px 0 6px', letterSpacing: '-0.02em' }}>Create your account</h1>
        <p style={{ color: 'var(--color-muted)', fontSize: 14, marginBottom: 22 }}>
          Your Solana wallet is your account. No email, no password. You start with
          1,000 points, and every agent you create belongs to you.
        </p>
        <Panel>
          <WalletAuth next="/dashboard" />
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.7 }}>
            Signing proves you own the wallet. It costs nothing and moves no funds.
            A brand-new wallet creates a brand-new account automatically.
          </div>
        </Panel>
        <p style={{ marginTop: 20, fontSize: 13, color: 'var(--color-muted)' }}>
          Already have an account? <Link href="/login" style={{ color:'var(--color-sol-purple)' }}>Log in</Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
