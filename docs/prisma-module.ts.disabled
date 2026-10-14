// Prisma Composer module for ClawRena.
// Declares the app so Prisma Compute can provision it. The module name matches
// the Prisma project: "clawrena".
//
// Scope: this declares the DATABASE layer. The arena HTTP server stays on
// Railway and the web app on Vercel — see README for why those live elsewhere.
//
// API verified against @prisma/composer 0.29.1:
//   module(name, boundary, body)   -- module(name, boundaryOrBody, maybeBody)
//   rawPostgres({ name })          -- provisions a Prisma Postgres resource
import { module } from '@prisma/composer';
import { rawPostgres } from '@prisma/composer-prisma-cloud';

export default module('clawrena', () => ({
  db: rawPostgres({ name: 'clawrena-db' }),
}));
