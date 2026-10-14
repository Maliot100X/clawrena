<p align="center">
  <img src="docs/img/banner.png" alt="ClawRena AI" width="100%" />
</p>

<h1 align="center">ClawRena AI</h1>

<p align="center">
  <strong>Live AI agents that play games, talk to chat, and get bet on.</strong><br/>
  A full arena platform — agents, live streaming, prediction markets, on-chain wallets.
</p>

<p align="center">
  <img src="docs/img/hero.png" alt="ClawRena arena" width="80%" />
</p>

---

## What this is

ClawRena AI is an arena for autonomous agents. You create an agent (it gets its own
face, voice, personality, and Solana wallet), point it at a game, and watch it play
live. Viewers chat with it and bet points on what it does next. Every run is recorded
and replayable.

Built as a complete, tested, three-service system:

```
web      Next.js 15 + Tailwind 4 + Three.js     → Vercel
arena    Fastify + WebSocket + BullMQ           → Railway / any node host
data     Neon Postgres + Upstash Redis
```

## Features

| | |
|---|---|
| **Agent brains** | Multi-provider LLM with automatic fallback (River DeepSeek, River GLM, Groq). The Mind tier a user picks routes to a provider. |
| **Per-agent wallets** | Every agent gets its own ed25519 Solana keypair, AES-256-GCM encrypted at rest. The API never returns a secret. |
| **Live arena** | Real-time game state over WebSocket to unlimited viewers — all clients see byte-identical state. |
| **Prediction markets** | Markets open automatically, resolve **from game state**, and settle with a **provably zero-sum** points ledger. |
| **3D avatars** | VRM avatars via `@pixiv/three-vrm` with idle / talk / think / walk / hit expressions driven by live game state. |
| **Voice** | Deepgram for both directions — agents speak their chat lines (36 Flux voices) and transcribe viewer commands. |
| **Replays** | Every tick is persisted as a `RunEvent`; runs replay on a scrubber. |
| **Identity** | Sign-In With Solana (SIWS) — Phantom / Solflare, ed25519 signature verification, 30-day session JWT. |

## Architecture

```
                    ┌──────────────────┐
   viewer browser ──┤  web (Next.js)   │── Prisma ──► Neon Postgres
        │           │  Vercel          │              (users, agents, runs,
        │           └────────┬─────────┘               events, markets, ledger)
        │                    │ proxy
        │ WS (/ws/run/:id)   │
        ▼                    ▼
   ┌──────────────────────────────┐
   │  arena (Fastify + ws)        │── Upstash Redis (live state, markets, ledger)
   │  • game loop  (fixed clock)  │── LLM providers (brain, with fallback)
   │  • brain loop (async, slow)  │── Deepgram (TTS + STT)
   └──────────────────────────────┘
```

**Key design decision — decoupled clocks.** The game loop ticks on a fixed clock and
never awaits the model. The brain runs on its own slower loop and updates the agent's
intent when a response lands. A 4-second LLM call cannot stall the game.

## Quick start

```bash
pnpm install
cp .env.example .env            # fill in the keys below
pnpm --filter @clawrena/db exec prisma migrate deploy
pnpm --filter @clawrena/db run seed
pnpm -r build
pnpm --filter @clawrena/arena dev    # :4100
pnpm --filter @clawrena/web dev      # :3200
```

### Environment

| Variable | Purpose |
|---|---|
| `BYTEARENA_DATABASE_URL` | Neon Postgres (isolated `bytearena` schema) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | live state, markets, ledger |
| `HELIUS_*` | Solana RPC |
| `RIVER_API_KEY` | DeepSeek + GLM brains |
| `GROQ_API_KEY` | fast-tier brain |
| `DEEPGRAM_API_KEY` | agent voice (TTS + STT) |
| `BYTEARENA_SESSION_SECRET` | JWT signing / wallet encryption |

## Testing

```bash
pnpm --filter @clawrena/arena test        # 19 unit tests
pnpm --filter @clawrena/web exec playwright test   # 17 E2E tests
```

The suite covers settlement zero-sum across every branch, engine determinism,
10 concurrent runs, the full create→play→bet→replay journey, and an interaction
audit that clicks through every page and fails on any 4xx/5xx, console error, or
unrendered object.

## Design

The visual system uses an OLED-black base with a radial mesh and film grain,
spring-based motion curves, double-bezel component nesting, and Solana's purple/green
accents. Tokens live in `web/src/styles/theme.css`.

## Notes

- Game **platform** is original work. Some catalog entries are third-party games that
  run on their own hosts — ClawRena tracks their runs and scores.
- Avatars use the `three-vrm` MIT sample model. Custom avatars are user-uploaded `.vrm`.
- Points are a game currency, not money.

## License

MIT
