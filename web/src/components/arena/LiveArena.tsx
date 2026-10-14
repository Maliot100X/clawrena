'use client';
// Live arena: WebSocket game state, agent thoughts/chat, avatar mood.
// Deliberately handles reconnect + never renders [object Object] (bugs found on the
// reference site during recon).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Badge, Panel, Button } from '@/components/ui';
import type { AvatarMood } from './VrmAvatar';

const VrmAvatar = dynamic(() => import('./VrmAvatar'), { ssr: false });

interface LiveState {
  tick?: number; level?: number; hp?: number; maxHp?: number;
  kills?: number; gold?: number; elapsedMs?: number; alive?: boolean;
}
interface Thought { text: string; provider: string; at: number }

const ARENA_WS = process.env.NEXT_PUBLIC_ARENA_WS ?? 'ws://localhost:4100';

export default function LiveArena({ runId, wsBase = ARENA_WS }:
  { runId: string; wsBase?: string }) {
  const [state, setState] = useState<LiveState | null>(null);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [provider, setProvider] = useState<string>('');
  const [status, setStatus] = useState<'connecting'|'live'|'closed'>('connecting');
  const [tab, setTab] = useState<'chat'|'state'|'bets'>('chat');
  const [chat, setChat] = useState<{ who: string; text: string }[]>([]);
  const ws = useRef<WebSocket | null>(null);
  const retry = useRef(0);

  const connect = useCallback(() => {
    setStatus('connecting');
    const socket = new WebSocket(`${wsBase}/ws/run/${runId}`);
    ws.current = socket;
    socket.onopen = () => { setStatus('live'); retry.current = 0; };
    socket.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.type === 'state' && m.state && typeof m.state === 'object') setState(m.state);
        if (m.type === 'error') setStatus('closed');
      } catch { /* ignore malformed frames — never render [object Object] */ }
    };
    socket.onclose = () => {
      setStatus('closed');
      if (retry.current < 5) { retry.current++; setTimeout(connect, 1200 * retry.current); }
    };
    socket.onerror = () => socket.close();
  }, [runId, wsBase]);

  useEffect(() => { connect(); return () => ws.current?.close(); }, [connect]);

  // poll the thoughts feed (agent chat) on its own cadence
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/arena/thoughts?id=${runId}`, { cache: 'no-store' });
        const j = await r.json();
        if (!stop && Array.isArray(j.thoughts)) {
          setThoughts(j.thoughts);
          setProvider(j.provider ?? '');
          setChat(j.thoughts.map((t: Thought) => ({ who: 'byteraa', text: t.text })));
        }
      } catch {}
      if (!stop) setTimeout(poll, 1500);
    };
    poll();
    return () => { stop = true; };
  }, [runId]);

  const mood: AvatarMood = useMemo(() => {
    if (state?.alive === false) return 'idle';
    if (!state) return 'idle';
    if ((state.hp ?? 100) < (state.maxHp ?? 100) * 0.4) return 'hit';
    if (thoughts.length) return 'talk';
    return 'walk';
  }, [state, thoughts.length]);

  const pct = state ? Math.max(0, Math.min(1, (state.hp ?? 0) / (state.maxHp || 100))) : 1;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 12 }}>
      <Panel style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', borderBottom: '1px solid var(--color-line)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Badge tone={status === 'live' ? 'live' : 'muted'}>
              {status === 'live' ? 'Live' : status === 'connecting' ? 'Connecting' : 'Offline'}
            </Badge>
            <span style={{ fontFamily: 'var(--font-term)', fontSize: 18 }}>
              lvl {state?.level ?? 1} · {Math.floor((state?.elapsedMs ?? 0)/1000)}s
            </span>
            {provider && <Badge tone="purple">{provider}</Badge>}
          </div>
          <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>
            {state?.kills ?? 0} kills · {state?.gold ?? 0} gold
          </span>
        </div>

        <div style={{ height: 440 }}>
          <VrmAvatar mood={mood} />
        </div>

        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-line)' }}>
          <div style={{ height: 8, borderRadius: 4, background: '#22222c', overflow: 'hidden' }}>
            <div style={{ width: `${pct*100}%`, height: '100%',
              background: pct < 0.4 ? 'var(--color-red)' : 'var(--color-sol-green)',
              transition: 'width .3s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
            <span style={{ color: 'var(--color-muted)' }}>HP {state?.hp ?? 100}/{state?.maxHp ?? 100}</span>
            <span style={{ color: 'var(--color-muted)' }}>ENTRY free · CROWD'S POT 0 pts · BETTORS 0</span>
          </div>
        </div>
      </Panel>

      <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
        <Panel>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {(['chat','state','bets'] as const).map(t => (
              <span key={t} onClick={() => setTab(t)} style={{ cursor: 'pointer',
                padding: '3px 10px', borderRadius: 999, fontSize: 12,
                border: '1px solid var(--color-line)',
                color: tab === t ? 'var(--color-ink)' : 'var(--color-muted)' }}>
                {t[0].toUpperCase() + t.slice(1)}
              </span>
            ))}
          </div>

          <div style={{ minHeight: 240, maxHeight: 300, overflowY: 'auto', fontSize: 13 }}>
            {tab === 'chat' && (chat.length ? chat.map((c, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <span style={{ color: 'var(--color-sol-purple)' }}>{c.who}</span>{' '}
                <span style={{ color: 'var(--color-ink)' }}>{c.text}</span>
              </div>
            )) : <span style={{ color: 'var(--color-muted)' }}>Waiting for the agent to speak…</span>)}

            {tab === 'state' && (
              <pre style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>
{JSON.stringify({ level: state?.level, hp: state?.hp, kills: state?.kills,
  gold: state?.gold, tick: state?.tick, alive: state?.alive }, null, 2)}
              </pre>
            )}

            {tab === 'bets' && <span style={{ color: 'var(--color-muted)' }}>
              Prediction markets arrive in Phase 8.
            </span>}
          </div>

          <input placeholder="Log in to chat" aria-label="chat message"
            style={{ width: '100%', marginTop: 10, padding: 10, borderRadius: 8,
              background: '#0b0b11', border: '1px solid var(--color-line)',
              color: 'var(--color-ink)' }} />
        </Panel>

        <Panel>
          <Button variant="ghost" style={{ width: '100%' }}>+ Open a prediction</Button>
        </Panel>
      </div>
    </div>
  );
}
