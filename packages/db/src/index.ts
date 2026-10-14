import { PrismaClient } from '@prisma/client';
const g = globalThis as unknown as { __db?: PrismaClient };
export const db = g.__db ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') g.__db = db;
export * from '@prisma/client';
