# Prisma

**Status: not used for the app.** ClawRena's database is **Neon Postgres**
(`BYTEARENA_DATABASE_URL`, schema `bytearena`). Everything works there.

## Why Prisma Composer was removed
`@prisma/composer` and `@prisma/composer-prisma-cloud` pull in `workerd`
(Cloudflare's ~39MB runtime). pnpm 12 blocks its build script, so
`pnpm install --frozen-lockfile` failed on Vercel and broke deployments.

The Prisma CLI (`prisma`, `@prisma/client`) is still used — that's what
generates the client and runs migrations against Neon.

## The GitHub deploy workflow
`.github/workflows/prisma-deploy.yml` remains. It uses GitHub OIDC
(`id-token: write`) and `prisma/cloud-deploy-action@v1`. If the repo is not
connected to a Prisma Compute project it exits green with
`skipped-no-credential` — it does not affect Vercel or the app.

To re-enable Composer later: reinstall the two packages, allow `workerd` in
`pnpm-workspace.yaml` under `onlyBuiltDependencies`, and restore
`docs/prisma-module.ts.disabled` to `prisma/module.ts`.
