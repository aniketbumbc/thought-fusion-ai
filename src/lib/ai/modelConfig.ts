import 'server-only'; // what does this do? server-only is a module that prevents the code from being executed on the client side.

export type ProviderId = 'openai' | 'anthropic' | 'google';

function readModelTimeout(): number {
  const raw = Number(process.env.MODEL_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 45_000;
}

export const config = {
  keys: {
    openai: process.env.OPENAI_API_KEY ?? '',
    anthropic: process.env.ANTHROPIC_API_KEY ?? '',
    google: process.env.GOOGLE_API_KEY ?? '',
  },
  candidateModels: {
    openai: process.env.OPENAI_MODEL ?? 'gpt-5.5',
    anthropic: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
    google: process.env.GOOGLE_MODEL ?? 'gemini-2.5-flash',
  },
  synthesizerModel: process.env.SYNTHESIZER_MODEL ?? 'claude-sonnet-4-6',
  modelTimeoutMs: readModelTimeout(),
  temperature: Number(process.env.MODEL_TEMPERATURE ?? 1),
} as const;

export function availableCandidates(): ProviderId[] {
  const availableModels: ProviderId[] = [];
  if (config.keys.openai) availableModels.push('openai');
  if (config.keys.anthropic) availableModels.push('anthropic');
  if (config.keys.google) availableModels.push('google');
  return availableModels;
}

export function canSynthesize(): boolean {
  return Boolean(config.keys.anthropic); // Anthropic is the only provider that can synthesize.
}
