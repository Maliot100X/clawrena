# Prisma Compute — ClawRena

This directory wires the repository to the Prisma project **clawrena**.

## What's here
- `module.ts` — the Composer module. Declares the `clawrena-db` Prisma Postgres
  resource. API verified against `@prisma/composer@0.29.1`
  (`module(name, boundary, body)` and `rawPostgres({ name })`).
- `../.github/workflows/prisma-deploy.yml` — the official deploy workflow
  (prisma/cloud-deploy-action@v1). Requires `id-token: write` for the OIDC
  token exchange, and Bun on the runner (`oven-sh/setup-bun@v2`).

## Deploy model
- Push to the **default branch** → deploys to **production**
- Push to **any other branch** → creates a **preview** stage
- Credentials come from GitHub OIDC — no secrets are stored in the repo.
  The GitHub connection to the Prisma project provides the exchange.

## Scope note
This declares the **database layer only**. The arena HTTP server runs on Railway
and the web app on Vercel. Porting the arena to Prisma Compute would mean:
Bun everywhere, replacing every `process.env` read with a Composer input schema
or `envSecret`, reading the listen port from `service.port()` bound to `0.0.0.0`,
and a single self-contained build entry file. That's a deliberate, separate piece
of work — not done here.

Reference: https://www.prisma.io/docs/compute/deploy-on-push
