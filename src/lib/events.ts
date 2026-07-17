import type {
  ProviderId,
  CandidateResult,
  SynthesisResult,
  GenerateResponse,
} from './types';

// Re-export so components import everything from one place.
export type { ProviderId, CandidateResult, SynthesisResult, GenerateResponse };

/**
 * Normalized events the client works with. The SSE parser (step 3) maps each
 * raw `event:` name to one of these. Note "final" and "error" get their `type`
 * added by the parser — on the wire their data has no `type` field.
 */
export type ClientEvent =
  | {
      type: 'candidate_started';
      provider: ProviderId;
      label: string;
      model: string;
    }
  | { type: 'candidate_done'; candidate: CandidateResult }
  | { type: 'synthesis_started'; usedProviders: ProviderId[] }
  | { type: 'synthesis_done'; synthesis: SynthesisResult }
  | { type: 'final'; result: GenerateResponse }
  | { type: 'error'; message: string };

/** Per-model card state. */
export type ModelStatus = 'pending' | 'thinking' | 'done' | 'failed';

export interface ModelView {
  provider: ProviderId;
  label: string; // e.g. "Claude · claude-sonnet-4-6"
  model: string;
  status: ModelStatus;
  answer: string | null;
  error: string | null;
  latencyMs: number | null;
  expanded: boolean; // Collapsible open/closed for done cards
}

/** Final-answer panel phase. */
export type FinalPhase =
  | 'idle'
  | 'waiting'
  | 'synthesizing'
  | 'result'
  | 'skipped';

/** Cosmetic dot color per provider (matches the design's per-card dot). */
export const PROVIDER_DOT: Record<ProviderId, string> = {
  openai: '#10a37f',
  anthropic: '#d97757',
  google: '#4285f4',
};
