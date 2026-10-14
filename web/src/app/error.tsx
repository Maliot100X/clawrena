'use client';
export default function GlobalError({ error, reset }:
  { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ padding: 40, color: 'var(--color-ink)' }}>
      <h1 style={{ letterSpacing: 1 }}>Something broke</h1>
      <p style={{ color: 'var(--color-muted)' }}>
        ClawRena hit an error rendering this view.
      </p>
      <pre style={{ background: '#121218', border: '1px solid var(--color-line)',
        borderRadius: 12, padding: 14, overflow: 'auto', fontSize: 12,
        color: 'var(--color-red)', maxWidth: 700 }}>
        {error.message}
        {error.digest ? `\n\ndigest: ${error.digest}` : ''}
      </pre>
      <button onClick={reset} style={{ marginTop: 16, padding: '10px 16px', border: 0,
        borderRadius: 10, background: '#fff', color: '#0a0a0f', fontWeight: 600, cursor: 'pointer' }}>
        Try again
      </button>
    </main>
  );
}
