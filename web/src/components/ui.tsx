import type { CSSProperties, ReactNode } from 'react';

// Component craft follows the high-end-visual-design skill:
//  - double-bezel nesting (outer tray + inner core, concentric radii)
//  - spring motion, never linear
//  - hairline top highlight for "machined hardware" depth
//  - island buttons with a nested trailing-icon chip

export function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: 'var(--color-panel)',
      border: '1px solid var(--color-line)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
      borderRadius: 'var(--radius-panel)', padding: 16, ...style }}>{children}</div>
  );
}

/** Double-bezel container: outer tray, inner core, concentric curves. */
export function Bezel({ children, style }:
  { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="bezel" style={style}>
      <div style={{ padding: 14 }}>{children}</div>
    </div>
  );
}

export function Card({ children, rarity = 'common', style }:
  { children: ReactNode; rarity?: 'common'|'rare'|'mythic'; style?: CSSProperties }) {
  const ring = { common: 'var(--color-line)',
                 rare: 'var(--color-sol-purple)',
                 mythic: 'var(--color-sol-green)' }[rarity];
  const glow = rarity === 'common' ? 'none' : `0 0 24px -10px ${ring}`;
  return (
    <div style={{ background: 'var(--color-card)',
      border: `1px solid ${ring}`,
      borderRadius: 'var(--radius-card)', padding: 14,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), ${glow}`,
      transition: 'all .6s var(--ease-spring)', ...style }}>{children}</div>
  );
}

export function Button({ children, variant = 'primary', onClick, style, trailing }:
  { children: ReactNode; variant?: 'primary'|'solana'|'ghost';
    onClick?: () => void; style?: CSSProperties; trailing?: ReactNode }) {
  const base: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 10,
    padding: '10px 18px', border: 0, cursor: 'pointer', fontWeight: 600, fontSize: 14,
    transition: 'all .6s var(--ease-spring)', borderRadius: '999px' };
  const styles: Record<string, CSSProperties> = {
    primary: { ...base, background: '#fff', color: '#08080c' },
    solana:  { ...base, background: 'linear-gradient(90deg,var(--color-sol-purple),var(--color-sol-green))',
               color: '#08080c', boxShadow: '0 8px 30px -12px var(--color-sol-purple)' },
    ghost:   { ...base, background: 'rgba(255,255,255,0.03)', color: 'var(--color-ink)',
               border: '1px solid var(--color-line)' },
  };
  return (
    <button onClick={onClick} style={{ ...styles[variant], ...style }}>
      {children}
      {trailing && (
        <span style={{ width: 26, height: 26, borderRadius: 999,
          display: 'grid', placeItems: 'center', fontSize: 12,
          background: variant === 'ghost' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)' }}>
          {trailing}
        </span>
      )}
    </button>
  );
}

export function Badge({ children, tone = 'muted' }:
  { children: ReactNode; tone?: 'muted'|'live'|'purple'|'green' }) {
  const c = { muted:'var(--color-muted)', live:'var(--color-red)',
              purple:'var(--color-sol-purple)', green:'var(--color-sol-green)' }[tone];
  return <span style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
    color: c, border: `1px solid ${c}40`, background: `${c}10`,
    borderRadius: 999, padding: '3px 10px', fontWeight: 500 }}>{children}</span>;
}

/** Eyebrow tag — the microscopic pill that precedes a heading. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}

export function Arcade({ children }: { children: ReactNode }) {
  return <span style={{ fontFamily: 'var(--font-arcade)', fontSize: 12, letterSpacing: 1 }}>{children}</span>;
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--color-muted)', letterSpacing: '0.16em',
        textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
    </div>
  );
}

/** Section wrapper with macro-whitespace (the skill says double your padding). */
export function Section({ children, style }:
  { children: ReactNode; style?: CSSProperties }) {
  return <section style={{ padding: '56px 0', ...style }}>{children}</section>;
}
