import { TopNav, Footer } from '@/components/nav';
import CreateAgent from '@/components/CreateAgent';

export default function Build() {
  return (
    <>
      <TopNav />
      <main style={{ padding: 22, maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ marginBottom: 4 }}>Create agent</h1>
        <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>
          It also gets its own wallet (one address per network) so it can pay to play.
        </p>
        <div style={{ marginTop: 16 }}>
          <CreateAgent />
        </div>
      </main>
      <Footer />
    </>
  );
}
