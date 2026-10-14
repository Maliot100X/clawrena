-- CreateEnum
CREATE TYPE "ProPlan" AS ENUM ('NONE', 'MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('COMMON', 'RARE', 'MYTHIC');

-- CreateEnum
CREATE TYPE "MindTier" AS ENUM ('ORC', 'HUMAN', 'WIZARD', 'HIGH_WIZARD');

-- CreateEnum
CREATE TYPE "Personality" AS ENUM ('STRATEGIST', 'DAREDEVIL', 'COMEDIAN', 'CAUTIOUS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "VoiceTier" AS ENUM ('SERVER_DEFAULT', 'STANDARD', 'PREMIUM', 'PRO');

-- CreateEnum
CREATE TYPE "GameKind" AS ENUM ('NATIVE', 'IFRAME', 'UPLOADED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'LIVE', 'FINISHED', 'ERROR');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('OPEN', 'CLOSED', 'RESOLVED', 'VOID');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "walletSolana" TEXT,
    "walletEvm" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1000,
    "proPlan" "ProPlan" NOT NULL DEFAULT 'NONE',
    "proUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "tagline" TEXT,
    "rarity" "Rarity" NOT NULL DEFAULT 'COMMON',
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "bodyModel" TEXT,
    "headModel" TEXT,
    "colors" JSONB,
    "scene" TEXT NOT NULL DEFAULT 'studio',
    "aura" TEXT NOT NULL DEFAULT 'auto',
    "mindTier" "MindTier" NOT NULL DEFAULT 'HUMAN',
    "personality" "Personality" NOT NULL DEFAULT 'DAREDEVIL',
    "customMind" TEXT,
    "voiceId" TEXT,
    "voiceTier" "VoiceTier" NOT NULL DEFAULT 'SERVER_DEFAULT',
    "language" TEXT NOT NULL DEFAULT 'en',
    "live" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentWallet" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "solanaPub" TEXT NOT NULL,
    "evmPub" TEXT,
    "stellarPub" TEXT,
    "encSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "GameKind" NOT NULL DEFAULT 'NATIVE',
    "embedUrl" TEXT,
    "coverUrl" TEXT,
    "live" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentGamePlaystyle" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playstyle" TEXT NOT NULL DEFAULT 'default',
    "rules" TEXT,

    CONSTRAINT "AgentGamePlaystyle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "seed" BIGINT NOT NULL,
    "result" TEXT,
    "score" INTEGER,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunEvent" (
    "id" BIGSERIAL NOT NULL,
    "runId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "resolvesBy" TEXT,
    "status" "MarketStatus" NOT NULL DEFAULT 'OPEN',
    "pot" INTEGER NOT NULL DEFAULT 0,
    "outcome" BOOLEAN,
    "closesAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "choice" BOOLEAN NOT NULL,
    "amount" INTEGER NOT NULL,
    "payout" INTEGER,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'chat',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "runId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refId" TEXT,
    "balance" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletSolana_key" ON "User"("walletSolana");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletEvm_key" ON "User"("walletEvm");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_handle_key" ON "Agent"("handle");

-- CreateIndex
CREATE INDEX "Agent_userId_idx" ON "Agent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentWallet_agentId_key" ON "AgentWallet"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentWallet_solanaPub_key" ON "AgentWallet"("solanaPub");

-- CreateIndex
CREATE UNIQUE INDEX "AgentWallet_evmPub_key" ON "AgentWallet"("evmPub");

-- CreateIndex
CREATE UNIQUE INDEX "AgentWallet_stellarPub_key" ON "AgentWallet"("stellarPub");

-- CreateIndex
CREATE UNIQUE INDEX "Game_slug_key" ON "Game"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AgentGamePlaystyle_agentId_gameId_key" ON "AgentGamePlaystyle"("agentId", "gameId");

-- CreateIndex
CREATE INDEX "Run_agentId_idx" ON "Run"("agentId");

-- CreateIndex
CREATE INDEX "Run_gameId_idx" ON "Run"("gameId");

-- CreateIndex
CREATE INDEX "Run_status_idx" ON "Run"("status");

-- CreateIndex
CREATE INDEX "RunEvent_runId_idx" ON "RunEvent"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "RunEvent_runId_seq_key" ON "RunEvent"("runId", "seq");

-- CreateIndex
CREATE INDEX "Market_runId_idx" ON "Market"("runId");

-- CreateIndex
CREATE INDEX "Market_status_idx" ON "Market"("status");

-- CreateIndex
CREATE INDEX "Bet_marketId_idx" ON "Bet"("marketId");

-- CreateIndex
CREATE INDEX "Bet_userId_idx" ON "Bet"("userId");

-- CreateIndex
CREATE INDEX "ChatMessage_runId_idx" ON "ChatMessage"("runId");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_gameId_score_idx" ON "LeaderboardEntry"("gameId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_gameId_runId_key" ON "LeaderboardEntry"("gameId", "runId");

-- CreateIndex
CREATE INDEX "PointLedger_userId_idx" ON "PointLedger"("userId");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentWallet" ADD CONSTRAINT "AgentWallet_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentGamePlaystyle" ADD CONSTRAINT "AgentGamePlaystyle_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentGamePlaystyle" ADD CONSTRAINT "AgentGamePlaystyle_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunEvent" ADD CONSTRAINT "RunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
