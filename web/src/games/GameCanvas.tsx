'use client';
// Client-only Phaser boundary. Picks the real game by slug.
import dynamic from 'next/dynamic';

const AiSurv  = dynamic(() => import('./AiSurvivors'), { ssr: false, loading: () => <Loading /> });
const Arcade  = dynamic(() => import('./ArcadeGame'),   { ssr: false, loading: () => <Loading /> });
const PixiG   = dynamic(() => import('./PixiSurvivors'), { ssr: false, loading: () => <Loading /> });

function Loading() {
  return (
    <div style={{ height: 460, display:'grid', placeItems:'center', background:'#0b0f14',
      borderRadius:'var(--radius-panel)', fontFamily:'var(--font-term)', fontSize:13,
      color:'var(--color-muted)' }}>loading game…</div>
  );
}

const BY_SLUG: Record<string, React.ComponentType<{ runId?: string }>> = {
  'survivors-pixi': PixiG,   // PixiJS v8, real sprites, your LLM drives it
  'survivors': PixiG,
};

export default function GameCanvas({ slug, runId }: { slug?: string; runId?: string }) {
  const C = (slug && BY_SLUG[slug]) || AiSurv;
  return <C runId={runId} />;
}
