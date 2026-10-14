// Shared types for ByteArena — mirrors the recon'd domain model.
export type Rarity = 'common' | 'rare' | 'mythic';
export type MindTier = 'orc' | 'human' | 'wizard' | 'high-wizard';
export type Personality = 'strategist' | 'daredevil' | 'comedian' | 'cautious' | 'custom';
export type RunStatus = 'queued' | 'live' | 'finished' | 'error';

export interface AgentCard {
  id: string;
  name: string;
  rarity: Rarity;
  level: number;
  runs: number;
  wins: number;
  games: number;
  live: boolean;
}
