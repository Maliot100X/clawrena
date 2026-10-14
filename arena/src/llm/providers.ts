// ClawRena agent brains — ONLY the providers verified working on this machine.
// Verified 2026-10-13:
//   river/deepseek-ai/DeepSeek-V4.1-Flash  200 "ready"
//   river/zai-org/GLM-5.3-Flash            200 (reasoning model; needs max_tokens >= ~500)
//   groq/openai/gpt-oss-120b               200 "ready"
// EXCLUDED: Neon AI Gateway (403 credits required). Do not re-add without credits.
export type ProviderId = 'river-deepseek' | 'river-glm' | 'groq-oss';

export interface Provider {
  id: ProviderId;
  label: string;
  baseUrl: string;
  key: () => string;
  model: string;
  maxTokens: number;   // reasoning models need headroom or content comes back empty
  temperature: number;
}

export const PROVIDERS: Record<ProviderId, Provider> = {
  'river-deepseek': {
    id: 'river-deepseek', label: 'DeepSeek V4.1 (River)',
    baseUrl: 'https://api.river.ai/v1/chat/completions',
    key: () => must('RIVER_API_KEY'),
    model: 'deepseek-ai/DeepSeek-V4.1-Flash',
    maxTokens: 700, temperature: 0.8,
  },
  'river-glm': {
    id: 'river-glm', label: 'GLM 5.3 (River)',
    baseUrl: 'https://api.river.ai/v1/chat/completions',
    key: () => must('RIVER_API_KEY'),
    model: 'zai-org/GLM-5.3-Flash',
    maxTokens: 1200, temperature: 0.8,   // observed: 60 tokens all went to reasoning
  },
  'groq-oss': {
    id: 'groq-oss', label: 'GPT-OSS 120B (Groq)',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    key: () => must('GROQ_API_KEY'),
    model: 'openai/gpt-oss-120b',
    maxTokens: 700, temperature: 0.8,
  },
};

// Mind tier -> provider, mirroring the reference's Orc/Human/Wizard/High Wizard.
export const MIND_TIER: Record<string, ProviderId> = {
  ORC: 'groq-oss',           // fast, cheap
  HUMAN: 'river-deepseek',   // default
  WIZARD: 'river-glm',       // deeper reasoning
  HIGH_WIZARD: 'river-glm',  // deepest available without Neon credits
};

function must(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`${k} not loaded`);
  return v;
}
