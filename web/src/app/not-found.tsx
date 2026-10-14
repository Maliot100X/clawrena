import Link from 'next/link';
export default function NotFound() {
  return (
    <main style={{ padding: 40 }}>
      <h1 style={{ letterSpacing: 1 }}>404</h1>
      <p style={{ color: 'var(--color-muted)' }}>Nothing here.</p>
      <Link href="/" style={{ color: 'var(--color-sol-purple)' }}>← back to the arena</Link>
    </main>
  );
}
