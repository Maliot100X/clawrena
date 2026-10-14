export default function Loading() {
  return (
    <main style={{ padding: 40, color: 'var(--color-muted)' }}>
      <div style={{ fontFamily: 'var(--font-term)', fontSize: 20 }}>Loading arena…</div>
      <div style={{ marginTop: 12, height: 8, width: 220, borderRadius: 4,
        background: 'linear-gradient(90deg,#121218,#22222c,#121218)' }} />
    </main>
  );
}
