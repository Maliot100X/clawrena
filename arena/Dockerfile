# ClawRena arena server.
# Built from the monorepo root so workspace deps (@clawrena/db, @clawrena/shared)
# resolve. Railpack guesses npm otherwise, and npm cannot read `workspace:*`.
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@12.9.1 --activate
WORKDIR /app

# ---- deps: install the whole workspace ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/db/package.json       packages/db/
COPY packages/shared/package.json   packages/shared/
COPY arena/package.json             arena/
COPY web/package.json               web/
RUN pnpm install --frozen-lockfile --ignore-scripts && pnpm --filter @clawrena/db generate || true

# ---- build ----
FROM deps AS build
COPY packages packages
COPY arena arena
RUN pnpm --filter @clawrena/db generate && pnpm --filter @clawrena/arena build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 4100
HEALTHCHECK --interval=20s --timeout=5s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.ARENA_PORT||4100)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["pnpm", "--filter", "@clawrena/arena", "start"]
