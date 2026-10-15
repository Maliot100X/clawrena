'use client';
// Client-only Phaser boundary. Picks the real game by slug.
import dynamic from 'next/dynamic';

const Survivors = dynamic(() => import('./BestSurvivors'), { ssr: false, loading: () => <Loading /> });
const Arcade    = dynamic(() => import('./ArcadeGame'),    { ssr: false, loading: () => <Loading /> });

function Loading() {
  return (
    <div style={{ height: 460, display:'grid', placeItems:'center', background:'#07070d',
      borderRadius:'var(--radius-panel)', fontFamily:'var(--font-term)', fontSize:13,
      color:'var(--color-muted)' }}>loading game…</div>
  );
}

const BY_SLUG: Record<string, React.ComponentType> = {
  'grid-survival': Survivors, 'tower-defense': Survivors, 'roguelike': Survivors, 'survival': Survivors,
  'card-game': Arcade, 'platformer': Arcade,
};

export default function GameCanvas({ slug }: { slug?: string }) {
  const C = (slug && BY_SLUG[slug]) || Survivors;
  return <C />;
}
