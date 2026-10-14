// Agent brain: turn game state -> a decision + a chat line, via a working provider.
import { PROVIDERS, MIND_TIER, type ProviderId } from './providers.js';
import type { GameState } from '../games/grid-survival.js';

export interface Thought {
  say: string;                 // chat line for the arena feed
  bias: { dx: number; dy: number };
  provider: ProviderId;
  fallback?: boolean;
}

const FALLBACK_CHAIN: ProviderId[] = ['river-deepseek', 'groq-oss', 'river-glm'];

async function callProvider(id: ProviderId, system: string, user: string): Promise<string> {
  const p = PROVIDERS[id];
  const res = await fetch(p.baseUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${p.key()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: p.model,
      messages: [ { role: 'system', content: system }, { role: 'user', content: user } ],
      max_tokens: p.maxTokens,
      temperature: p.temperature,
    }),
  });
  if (!res.ok) throw new Error(`${id} HTTP ${res.status}`);
  const j: any = await res.json();
  const text = j?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(`${id} returned empty content`);
  return text;
}

/** Ask the agent's mind what to do, with automatic fallback across working providers. */
export async function think(
  opts: { agentName: string; mindTier: string; personality: string; state: GameState; }
): Promise<Thought> {
  const primary = MIND_TIER[opts.mindTier] ?? 'river-deepseek';
  const order = [primary, ...FALLBACK_CHAIN.filter(p => p !== primary)];

  const system =
    `You are ${opts.agentName}, an AI agent playing a live survival game in a public arena. ` +
    `Personality: ${opts.personality}. You talk to your viewers while you play. ` +
    `Reply with STRICT JSON only, no markdown, no prose outside it: ` +
    `{"say":"<one short line to chat, max 90 chars>","dx":<-1|0|1>,"dy":<-1|0|1>}`;
  const user =
    `Game state: level ${opts.state.level}, hp ${opts.state.hp}/${opts.state.maxHp}, ` +
    `kills ${opts.state.kills}, gold ${opts.state.gold}, enemies nearby ${opts.state.enemies.length}. ` +
    `Give your next move and a line for chat.`;

  let lastErr = '';
  for (const [i, id] of order.entries()) {
    try {
      const raw = await callProvider(id, system, user);
      const parsed = extractJson(raw);
      return {
        say: String(parsed.say ?? '...').slice(0, 120),
        bias: {
          dx: clamp(Number(parsed.dx) || 0),
          dy: clamp(Number(parsed.dy) || 0),
        },
        provider: id,
        fallback: i > 0,
      };
    } catch (e: any) {
      lastErr = e.message;
    }
  }
  // every provider failed — degrade gracefully, never crash the run
  return {
    say: `(${lastErr.slice(0, 60)})`,
    bias: { dx: rand(), dy: rand() },
    provider: primary,
    fallback: true,
  };
}

function extractJson(s: string): any {
  // models sometimes wrap in ```json ... ``` — pull the first {...}
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no JSON in reply');
  return JSON.parse(m[0]);
}
const clamp = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);
const rand = () => Math.floor(Math.random() * 3) - 1;
