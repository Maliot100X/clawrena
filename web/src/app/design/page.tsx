import { Panel, Card, Button, Badge, Arcade, Stat } from '@/components/ui';
import { TopNav, Footer } from '@/components/nav';

const SWATCH: [string,string][] = [
  ['bg','#0a0a0f'], ['panel','#121218'], ['card','#0b0b11'],
  ['sol-purple','#9945ff'], ['sol-green','#14f195'], ['cyan','#3fd0ff'],
  ['red','#ff4d5e'], ['yellow','#ffcf4d'], ['lavender','#a78bfa'], ['mint','#6fe3b4'],
];

export default function Design() {
  return (
    <>
    <TopNav />
    <main style={{ padding: 28, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ letterSpacing: 2 }}>ClawRena AI — design system</h1>
      <p style={{ color: 'var(--color-muted)' }}>Tokens extracted from recon. Every component below renders live.</p>

      <h2 style={{ marginTop: 28 }}>Colors</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
        {SWATCH.map(([n,hex]) => (
          <Panel key={n}>
            <div style={{ height: 44, borderRadius: 8, background: hex,
              border: '1px solid var(--color-line)' }} />
            <div style={{ fontSize: 12, marginTop: 8 }}>{n}</div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: 'monospace' }}>{hex}</div>
          </Panel>
        ))}
      </div>

      <h2 style={{ marginTop: 28 }}>Fonts</h2>
      <Panel>
        <div style={{ fontSize: 20 }}>Instrument Sans — body & UI</div>
        <div style={{ marginTop: 8 }}><Arcade>PRESS START 2P — ARCADE</Arcade></div>
        <div style={{ fontFamily: 'var(--font-term)', fontSize: 22, marginTop: 8 }}>
          VT323 — terminal readout: lvl 10 · 6:28 · 912 KILLS
        </div>
      </Panel>

      <h2 style={{ marginTop: 28 }}>Buttons</h2>
      <Panel>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button>Primary</Button>
          <Button variant="solana">✦ Create agent</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
      </Panel>

      <h2 style={{ marginTop: 28 }}>Cards (rarity)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {(['common','rare','mythic'] as const).map(r => (
          <Card key={r} rarity={r}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight: 700 }}>byteraa</span><Badge tone={r==='mythic'?'green':r==='rare'?'purple':'muted'}>{r}</Badge>
            </div>
            <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 6 }}>LV 14 · 161 runs</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
              <Stat value={161} label="runs" /><Stat value={6} label="wins" />
              <Stat value="4%" label="win rate" />
            </div>
          </Card>
        ))}
      </div>

      <h2 style={{ marginTop: 28 }}>Badges</h2>
      <Panel>
        <div style={{ display: 'flex', gap: 8 }}>
          <Badge tone="live">Live</Badge><Badge tone="purple">Mythic</Badge>
          <Badge tone="green">Ready</Badge><Badge>Standby</Badge>
        </div>
      </Panel>
    </main>
    <Footer />
    </>
  );
}
